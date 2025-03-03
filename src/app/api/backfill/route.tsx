// app/api/backfill/route.ts
import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs/promises'
import path from 'path'
import { validateStartDate, validateEndDate } from '@/lib/utils'
import { existsSync } from 'fs'

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json()
    const { 
      event_name, 
      external_customer_id, 
      start_date, 
      end_date, 
      events_per_day, 
      properties,
      backfill_customer_id,
      test_mode = false // Add a test mode flag with default value of false
    } = body

    // Log the received request
    console.log('Received backfill request:', {
      event_name,
      external_customer_id,
      start_date,
      end_date,
      events_per_day,
      backfill_customer_id,
      test_mode,
      properties_keys: properties ? Object.keys(properties) : []
    })

    // Validate required fields
    if (!event_name || !start_date || !end_date) {
      console.log('Missing required fields')
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate the start date
    const startValidation = validateStartDate(start_date)
    if (!startValidation.isValid) {
      console.log('Invalid start date:', startValidation.errorMessage)
      return NextResponse.json(
        { success: false, message: startValidation.errorMessage || 'Invalid start date' },
        { status: 400 }
      )
    }
    
    // Validate the end date
    const endValidation = validateEndDate(end_date, start_date)
    if (!endValidation.isValid) {
      console.log('Invalid end date:', endValidation.errorMessage)
      return NextResponse.json(
        { success: false, message: endValidation.errorMessage || 'Invalid end date' },
        { status: 400 }
      )
    }

    // Generate a unique job ID
    const jobId = uuidv4()
    
    // Create the full configuration object
    const scriptConfig = {
      jobId,
      event_name,
      external_customer_id: external_customer_id || null,
      backfill_customer_id: backfill_customer_id || null,
      start_date,
      end_date,
      events_per_day: events_per_day || 100,
      properties
    }
    
    // If in test mode, just return the validated config without running the script
    if (test_mode) {
      console.log('Test mode enabled, returning validated config')
      return NextResponse.json({
        success: true,
        message: 'Validation successful (test mode)',
        jobId,
        config: scriptConfig
      })
    }

    // Not in test mode, proceed with actual script execution
    
    // Get the root directory of the project
    const rootDir = process.cwd()
    console.log('Root directory:', rootDir)
    
    // Create the tmp directory if it doesn't exist
    const tempDir = path.join(rootDir, 'tmp')
    await fs.mkdir(tempDir, { recursive: true })
    console.log('Tmp directory created/verified at:', tempDir)
    
    // The full path to the config file
    const configFilePath = path.join(tempDir, `${jobId}_config.json`)
    
    // Write the configuration to a file
    await fs.writeFile(configFilePath, JSON.stringify(scriptConfig, null, 2))
    console.log(`Config file created at: ${configFilePath}`)

    // Get script path from environment variables or use default
    const scriptPath = process.env.PYTHON_BACKFILL_SCRIPT_PATH || 
                       path.join(rootDir, 'src', 'scripts', 'Backfills', 'new_backfill_events.py')
    console.log(`Looking for script at: ${scriptPath}`)
    
    // Check if the script exists at the expected location
    if (!existsSync(scriptPath)) {
      console.error(`Script not found at: ${scriptPath}`)
      return NextResponse.json({
        success: false,
        message: `Python script not found at the configured path: ${scriptPath}. Please check your PYTHON_BACKFILL_SCRIPT_PATH environment variable.`,
        jobId
      }, { status: 500 })
    }
    
    console.log(`Script found at: ${scriptPath}`)

    // Execute the Python script with the config file
    const command = `python3 "${scriptPath}" --config-file "${configFilePath}"`
    console.log(`Executing command: ${command}`)
    
    // Get the API token from environment variables
    const orbApiToken = process.env.ORB_API_TOKEN
    if (!orbApiToken) {
      console.warn('ORB_API_TOKEN environment variable is not set')
    } else {
      console.log('ORB_API_TOKEN is available')
    }
    
    // Start the process asynchronously with environment variables
    exec(command, { 
      env: { 
        ...process.env,
        // Make sure the API token is available to the Python script
        // Set both possible variable names to ensure compatibility
        ORB_API_KEY: orbApiToken, 
        ORB_API_TOKEN: orbApiToken
      } 
    }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Backfill error: ${error}`)
        // In a production system, you would update the job status in a database
      }
      console.log(`Backfill output: ${stdout}`)
      if (stderr) {
        console.error(`Backfill stderr: ${stderr}`)
      }
      
      // Clean up the configuration file after script execution
      fs.unlink(configFilePath).catch(error => {
        console.error(`Error cleaning up config file: ${error}`)
      })
    })

    // Return immediate success response with the job ID
    return NextResponse.json({
      success: true,
      message: 'Backfill job submitted successfully',
      jobId
    })
  } catch (error) {
    console.error('Error processing backfill request:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}