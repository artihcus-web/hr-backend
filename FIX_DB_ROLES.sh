#!/bin/bash

# Configuration
CONTAINER_NAME="mongodb"
ADMIN_USER="admin"
ADMIN_PASS="Artihcus@123" # Deduced from previous context

echo "🔧 Attempting to fix MongoDB User Roles..."

# Try to grant 'root' role to the admin user
# This ensures 'admin' can access ANY database (including 'myapp')
winpy_cmd="db.grantRolesToUser('$ADMIN_USER', [{role: 'root', db: 'admin'}])"

echo "Executing role update on container '$CONTAINER_NAME'..."

docker exec $CONTAINER_NAME mongosh -u $ADMIN_USER -p "$ADMIN_PASS" --authenticationDatabase admin --eval "$winpy_cmd"

if [ $? -eq 0 ]; then
    echo "✅ Success! User '$ADMIN_USER' now has 'root' privileges."
    echo "This should fix the 'requires authentication' error."
    echo ""
    echo "👉 Now, restart your backend container one last time:"
    echo "   docker compose -f docker-compose.prod.yml restart backend"
else
    echo "❌ Failed to update roles."
    echo "Double check if the password '$ADMIN_PASS' is correct."
    echo "If you use a different password, edit this script and update ADMIN_PASS."
fi
