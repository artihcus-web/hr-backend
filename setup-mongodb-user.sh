#!/bin/bash
# Script to create MongoDB application user
# Run this once to create a dedicated app user (more secure than using admin)

echo "🔐 Setting up MongoDB application user..."

# Connect to MongoDB and create user
mongosh -u admin -p Admin@123 --authenticationDatabase admin <<EOF
use myapp
db.createUser({
  user: "appuser",
  pwd: prompt("Enter password for appuser: "),
  roles: [ { role: "readWrite", db: "myapp" } ]
})
db.getUsers()
exit
EOF

echo "✅ Application user created!"
echo ""
echo "Update your .env file with:"
echo "MONGODB_URI=mongodb://appuser:YOUR_PASSWORD@localhost:27017/myapp?authSource=myapp"
echo ""
echo "Or continue using admin user with:"
echo "MONGODB_URI=mongodb://admin:Admin%40123@localhost:27017/myapp?authSource=admin"

