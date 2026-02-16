import { ObjectId } from 'mongodb'

/**
 * Transform user object to convert GridFS profileImage ID to endpoint URL
 * @param {Object} user - User object (can be Mongoose document or plain object)
 * @returns {Object} User object with profileImage as endpoint URL if it's a GridFS ID
 */
export function transformProfileImage(user) {
  if (!user || !user.profileImage) return user
  
  const userObj = user.toObject ? user.toObject() : { ...user }
  
  // If profileImage is a GridFS ObjectId (24 char hex), convert to endpoint URL
  if (ObjectId.isValid(userObj.profileImage) && userObj._id) {
    userObj.profileImage = `/api/auth/users/${userObj._id}/avatar`
  }
  
  return userObj
}

/**
 * Transform an array of users
 * @param {Array} users - Array of user objects
 * @returns {Array} Array of transformed user objects
 */
export function transformUsers(users) {
  if (!Array.isArray(users)) return users
  return users.map(user => transformProfileImage(user))
}
