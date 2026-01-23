import dotenv from 'dotenv';
dotenv.config();

console.log('--- ENV DEBUG START ---');
console.log('Current Directory:', process.cwd());
console.log('MONGODB_URI Loaded:', !!process.env.MONGODB_URI);
if (process.env.MONGODB_URI) {
    // Mask password for security
    const uri = process.env.MONGODB_URI;
    const masked = uri.replace(/:([^:@]+)@/, ':****@');
    console.log('MONGODB_URI Value:', masked);
    
    // Check for "admin" vs "appuser" vs empty
    console.log('User in URI:', uri.includes('//admin:') ? 'admin' : (uri.includes('//appuser:') ? 'appuser' : 'none/unknown'));
} else {
    console.log('MONGODB_URI is UNDEFINED. Using default fallback?');
}
console.log('--- ENV DEBUG END ---');
