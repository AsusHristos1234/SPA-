/** @type {import('next').NextConfig} */
const nextConfig = {
    // output: 'export', // ЗАКОММЕНТИРУЙ эту строку
    trailingSlash: true,
    images: {
        unoptimized: true,
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'images.unsplash.com'
            }
        ]
    }
}

module.exports = nextConfig