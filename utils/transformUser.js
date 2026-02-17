import { ObjectId } from 'mongodb'

/**
 * Transform user object: convert GridFS profileImage ObjectId to endpoint URL.
 * Backend stores GridFS ObjectId; API returns /api/auth/users/:id/avatar for consistency.
 */
export function transformProfileImage(user) {
  if (!user || !user.profileImage) return user

  const userObj = user.toObject ? user.toObject() : { ...user }

  if (!userObj._id) return userObj

  // Already endpoint path - ensure consistency
  if (typeof userObj.profileImage === 'string' && userObj.profileImage.includes('/avatar')) {
    if (!userObj.profileImage.startsWith('/api/auth/users/')) {
      userObj.profileImage = `/api/auth/users/${userObj._id}/avatar`
    }
    return userObj
  }

  // GridFS ObjectId - convert to endpoint
  if (ObjectId.isValid(userObj.profileImage)) {
    userObj.profileImage = `/api/auth/users/${userObj._id}/avatar`
  }

  return userObj
}

/**
 * Transform an array of users
 */
export function transformUsers(users) {
  if (!Array.isArray(users)) return users
  return users.map(user => transformProfileImage(user))
}
