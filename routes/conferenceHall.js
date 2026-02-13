import express from 'express'
import ConferenceHall from '../models/ConferenceHall.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

// Get all bookings
router.get('/bookings', authenticate, async (req, res) => {
  try {
    const bookings = await ConferenceHall.find()
      .populate('bookedBy', 'fullName username email')
      .sort({ date: 1, startTime: 1 })
    
    res.json({ bookings })
  } catch (error) {
    console.error('Error fetching conference hall bookings:', error)
    res.status(500).json({ message: 'Server error while fetching bookings' })
  }
})

// Create a new booking
router.post('/bookings', authenticate, async (req, res) => {
  try {
    const { teamName, title, description, date, startTime, endTime } = req.body

    // Validation
    if (!teamName || !title || !date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Team name, title, date, start time, and end time are required' })
    }

    // Validate time format and logic
    if (startTime >= endTime) {
      return res.status(400).json({ message: 'End time must be after start time' })
    }

    // Check for overlapping bookings
    const overlappingBooking = await ConferenceHall.findOne({
      date,
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime }
        }
      ]
    })

    if (overlappingBooking) {
      return res.status(400).json({ 
        message: 'This time slot is already booked. Please choose another time.' 
      })
    }

    // Create booking
    const booking = new ConferenceHall({
      bookedBy: req.user._id,
      teamName,
      title,
      description: description || '',
      date,
      startTime,
      endTime
    })

    await booking.save()

    // Populate the bookedBy field for response
    await booking.populate('bookedBy', 'fullName username email')

    res.status(201).json({ 
      message: 'Conference hall booked successfully',
      booking 
    })
  } catch (error) {
    console.error('Error creating conference hall booking:', error)
    res.status(500).json({ message: 'Server error while creating booking' })
  }
})

// Get bookings for a specific date
router.get('/bookings/date/:date', authenticate, async (req, res) => {
  try {
    const { date } = req.params
    const bookings = await ConferenceHall.find({ date })
      .populate('bookedBy', 'fullName username email')
      .sort({ startTime: 1 })
    
    res.json({ bookings })
  } catch (error) {
    console.error('Error fetching bookings for date:', error)
    res.status(500).json({ message: 'Server error while fetching bookings' })
  }
})

// Update a booking (only by the person who booked it or admin)
router.put('/bookings/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    const { teamName, title, description, date, startTime, endTime } = req.body

    const booking = await ConferenceHall.findById(id)
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' })
    }

    // Check if user is the owner or admin
    if (booking.bookedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You can only update your own bookings' })
    }

    // If date/time is being changed, check for conflicts
    if (date || startTime || endTime) {
      const checkDate = date || booking.date
      const checkStartTime = startTime || booking.startTime
      const checkEndTime = endTime || booking.endTime

      if (checkStartTime >= checkEndTime) {
        return res.status(400).json({ message: 'End time must be after start time' })
      }

      const overlappingBooking = await ConferenceHall.findOne({
        _id: { $ne: id },
        date: checkDate,
        $or: [
          {
            startTime: { $lt: checkEndTime },
            endTime: { $gt: checkStartTime }
          }
        ]
      })

      if (overlappingBooking) {
        return res.status(400).json({ 
          message: 'This time slot is already booked. Please choose another time.' 
        })
      }
    }

    // Update booking
    if (teamName) booking.teamName = teamName
    if (title) booking.title = title
    if (description !== undefined) booking.description = description
    if (date) booking.date = date
    if (startTime) booking.startTime = startTime
    if (endTime) booking.endTime = endTime

    await booking.save()
    await booking.populate('bookedBy', 'fullName username email')

    res.json({ 
      message: 'Booking updated successfully',
      booking 
    })
  } catch (error) {
    console.error('Error updating booking:', error)
    res.status(500).json({ message: 'Server error while updating booking' })
  }
})

// Delete a booking (only by the person who booked it or admin)
router.delete('/bookings/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params

    const booking = await ConferenceHall.findById(id)
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' })
    }

    // Check if user is the owner or admin
    if (booking.bookedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You can only delete your own bookings' })
    }

    await ConferenceHall.findByIdAndDelete(id)

    res.json({ message: 'Booking deleted successfully' })
  } catch (error) {
    console.error('Error deleting booking:', error)
    res.status(500).json({ message: 'Server error while deleting booking' })
  }
})

export default router
