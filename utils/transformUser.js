import { ObjectId } from 'mongodb'

/**
 * Transform user object: convert GridFS profileImage ObjectId to endpoint URL.
 * Backend stores GridFS ObjectId; API returns /api/auth/users/:id/avatar for consistency.
 */
export function transformProfileImage(user) {
  if (!user) return user
  try {
    const userObj = user.toObject ? user.toObject() : { ...user }
    if (!userObj._id) return userObj
    if (!userObj.profileImage) return userObj

    // Already endpoint path - ensure consistency
    if (typeof userObj.profileImage === 'string' && userObj.profileImage.includes('/avatar')) {
      if (!userObj.profileImage.startsWith('/api/auth/users/')) {
        userObj.profileImage = `/api/auth/users/${userObj._id}/avatar`
      }
      return userObj
    }

    // GridFS ObjectId - convert to endpoint (guard against non-string/non-ObjectId)
    if (userObj.profileImage != null && ObjectId.isValid(userObj.profileImage)) {
      userObj.profileImage = `/api/auth/users/${userObj._id}/avatar`
    }

    return userObj
  } catch {
    return user.toObject ? user.toObject() : { ...user }
  }
}

/**
 * Transform an array of users
 */
export function transformUsers(users) {
  if (!Array.isArray(users)) return users
  return users.map(user => transformProfileImage(user))
}
