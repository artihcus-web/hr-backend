# Nginx Config Update Instructions

## Quick Fix: Add /uploads Location Block

You need to add the `/uploads` location block to your existing nginx config. Here's how:

### Step 1: Edit the existing nginx config

```bash
sudo nano /etc/nginx/sites-available/api.artihcus.com
```

### Step 2: Add this block after the `/api` location block

Find the section that looks like this:
```nginx
location /api {
    proxy_pass http://127.0.0.1:5000;
    ...
}
```

**Add this RIGHT AFTER the closing `}` of the `/api` location block:**

```nginx
    # Proxy uploads (images and documents) to backend
    location /uploads {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Cache headers for static files
        proxy_cache_valid 200 1y;
        proxy_cache_valid 404 1h;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
    }
```

### Step 3: Do this for BOTH server blocks

You need to add the `/uploads` block in TWO places:
1. Inside the `server` block for port 443 (around line 50)
2. Inside the `server` block for port 8443 (around line 110)

### Step 4: Test and reload

```bash
# Test nginx configuration
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx
```

## Option 2: Use sed to add it automatically

```bash
# Backup current config
sudo cp /etc/nginx/sites-available/api.artihcus.com /etc/nginx/sites-available/api.artihcus.com.backup

# Add /uploads block after /api block (for port 443)
sudo sed -i '/location \/api {/,/^    }$/a\
\
    # Proxy uploads (images and documents) to backend\
    location /uploads {\
        proxy_pass http://127.0.0.1:5000;\
        proxy_http_version 1.1;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        \
        # Cache headers for static files\
        proxy_cache_valid 200 1y;\
        proxy_cache_valid 404 1h;\
        add_header Cache-Control "public, max-age=31536000, immutable" always;\
    }' /etc/nginx/sites-available/api.artihcus.com

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

## Option 3: View current config and manually edit

```bash
# View current config
sudo cat /etc/nginx/sites-available/api.artihcus.com

# Edit it
sudo nano /etc/nginx/sites-available/api.artihcus.com
```

## What to Add (Complete Block)

Add this block **twice** - once in each server block (port 443 and port 8443):

```nginx
    # Proxy uploads (images and documents) to backend
    location /uploads {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Cache headers for static files
        proxy_cache_valid 200 1y;
        proxy_cache_valid 404 1h;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
    }
```

## Verify It Works

After updating and reloading nginx:

```bash
# Test if uploads are accessible
curl -I https://api.artihcus.com/uploads/profiles/test.jpg

# Should return 200 or 404 (not 502 Bad Gateway)
```

## Troubleshooting

If you get errors:
1. Check nginx error log: `sudo tail -f /var/log/nginx/error.log`
2. Verify backend is running: `curl http://127.0.0.1:5000/api/health`
3. Check file permissions: `ls -la /etc/nginx/sites-available/api.artihcus.com`
