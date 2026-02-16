# Image Loading Issues - Fix Summary

## Problems Identified

### 1. **Production: Images Not Visible**
- **Root Cause**: Nginx configuration only proxied `/api` routes, not `/uploads` routes
- **Symptom**: When frontend requests `https://api.artihcus.com/uploads/profiles/xxx.jpg`, nginx returns 404
- **Fix**: Added `/uploads` location block to nginx config to proxy uploads to backend

### 2. **Local: Slow Image Loading**
- **Root Cause**: No caching headers on static files
- **Symptom**: Images reload on every request, causing slow performance
- **Fix**: Added cache headers (1 year for images, 1 day for PDFs) to express.static

### 3. **Path Resolution Issue**
- **Root Cause**: Relative path `'uploads'` might resolve incorrectly in production
- **Fix**: Changed to absolute path using `path.join(__dirname, 'uploads')`

## Changes Made

### 1. `server.js`
- Added `path` and `fileURLToPath` imports for ES modules
- Changed static file serving to use absolute path
- Added caching headers for better performance:
  - Images: `Cache-Control: public, max-age=31536000, immutable` (1 year)
  - PDFs: `Cache-Control: public, max-age=86400` (1 day)
- Enabled ETag and Last-Modified headers

### 2. `nginx-updated-config.conf`
- Added `/uploads` location block to both server blocks (port 443 and 8443)
- Configured proxy_pass to backend port 5000
- Added cache headers for static files

## Deployment Steps

### 1. Update Nginx Configuration
```bash
# Copy the updated nginx config
sudo cp nginx-updated-config.conf /etc/nginx/sites-available/api.artihcus.com

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 2. Ensure Uploads Directory Exists
```bash
# On production server, ensure uploads directory exists
mkdir -p /path/to/hr-backend/uploads/profiles
chmod 755 /path/to/hr-backend/uploads/profiles
```

### 3. Restart Backend
```bash
# Restart your Node.js backend (PM2, systemd, or Docker)
pm2 restart hr-backend
# OR
sudo systemctl restart hr-backend
# OR (if using Docker)
docker-compose restart backend
```

### 4. Verify
- Check that images load: `https://api.artihcus.com/uploads/profiles/[filename].jpg`
- Check browser Network tab for proper cache headers
- Verify images load quickly on subsequent visits

## Environment Variables

Ensure `VITE_API_URL` is set correctly in production:
```bash
# In .env or build environment
VITE_API_URL=https://api.artihcus.com
```

## Testing

### Local Testing
1. Start backend: `npm start`
2. Upload a profile image
3. Check browser Network tab - should see cache headers
4. Refresh page - image should load instantly from cache

### Production Testing
1. Deploy updated nginx config
2. Restart backend
3. Access image URL directly: `https://api.artihcus.com/uploads/profiles/[filename].jpg`
4. Should return 200 OK with image
5. Check response headers for cache headers

## Troubleshooting

### Images Still Not Loading in Production
1. Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`
2. Verify backend is running: `curl http://127.0.0.1:5000/api/health`
3. Check uploads directory exists and is accessible
4. Verify nginx config syntax: `sudo nginx -t`

### Images Still Loading Slowly Locally
1. Clear browser cache
2. Check Network tab for cache headers
3. Verify express.static is using correct path
4. Check file permissions on uploads directory
