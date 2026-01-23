#!/bin/bash
# Commands to check if latest Docker image is running on server

echo "=== 1. Check Current Container Image ==="
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.CreatedAt}}"

echo -e "\n=== 2. Check Image Details ==="
docker inspect backend | grep -E '"Image"|"Created"|"RepoTags"'

echo -e "\n=== 3. Check Image Pull Time ==="
docker images harshava123/ser-backend:latest --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}\t{{.Size}}"

echo -e "\n=== 4. Pull Latest Image from Docker Hub ==="
docker pull harshava123/ser-backend:latest

echo -e "\n=== 5. Compare Image IDs ==="
echo "Current container image:"
docker inspect backend --format='{{.Image}}'
echo "Latest pulled image:"
docker images harshava123/ser-backend:latest --format='{{.ID}}'

echo -e "\n=== 6. Check if Container Needs Restart ==="
CONTAINER_IMAGE=$(docker inspect backend --format='{{.Image}}')
LATEST_IMAGE=$(docker images harshava123/ser-backend:latest --format='{{.ID}}')

if [ "$CONTAINER_IMAGE" != "$LATEST_IMAGE" ]; then
    echo "⚠️  Container is NOT using latest image!"
    echo "Container image ID: $CONTAINER_IMAGE"
    echo "Latest image ID: $LATEST_IMAGE"
    echo "Run: docker-compose pull && docker-compose up -d"
else
    echo "✅ Container is using latest image!"
fi

echo -e "\n=== 7. Check Image Digest (for exact version) ==="
docker inspect harshava123/ser-backend:latest --format='{{.RepoDigests}}'

echo -e "\n=== 8. Check Docker Hub Latest (requires docker login) ==="
# docker manifest inspect harshava123/ser-backend:latest | grep -E '"digest"|"mediaType"'

