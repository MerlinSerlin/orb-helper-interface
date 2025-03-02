// app/api/backfill/route.ts
import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs/promises'
import path from 'path'
import { validateStartDate, validateEndDate } from '@/lib/utils'

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
    
    // Create a configuration file for the Python script
    const tempDir = path.join(process.cwd(), 'tmp')
    await fs.mkdir(tempDir, { recursive: true })
    
    const configFilePath = path.join(tempDir, `${jobId}_config.json`)
    
    // Write the configuration to a file
    await fs.writeFile(configFilePath, JSON.stringify(scriptConfig, null, 2))
    console.log(`Config file created at: ${configFilePath}`)

    // Execute the Python script with the config file
    const command = `python3 ./scripts/new_backfill_events.py --config-file ${configFilePath}`
    console.log(`Executing command: ${command}`)
    
    // Start the process asynchronously
    exec(command, (error, stdout, stderr) => {
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