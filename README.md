# Media CDN Manager

An open-source, production-ready media management application built with Next.js, AWS S3, and CloudFront. Upload, organize, and manage your media files with a beautiful, modern interface.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## Features

- 🚀 **Fast Upload** - Drag & drop or click to upload files to S3
- 📁 **Category Management** - Organize files into Images, Documents, Videos, and Others
- 🖼️ **Image Gallery** - Beautiful grid view for images with previews
- 🎥 **Video Support** - Video previews and management
- 📋 **File List** - Table view for documents and other files
- 🔗 **CDN URLs** - Automatic CloudFront URL generation with one-click copy
- 🗑️ **Delete Files** - Easy file deletion with confirmation
- 🎨 **Modern UI** - Clean, responsive design built with Tailwind CSS
- ⚡ **Performance** - Optimized with Next.js 15 and React 19

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- AWS Account with:
  - S3 Bucket
  - CloudFront Distribution
  - IAM User with S3 permissions

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd media-cdn-manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your AWS credentials:
   ```env
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_access_key_id
   AWS_SECRET_ACCESS_KEY=your_secret_access_key
   AWS_S3_BUCKET_NAME=your_bucket_name
   AWS_CLOUDFRONT_DOMAIN=your_cloudfront_domain.cloudfront.net
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## AWS Setup

### 1. Create S3 Bucket

1. Go to AWS S3 Console
2. Create a new bucket
3. Configure bucket settings (region, versioning, etc.)
4. Set up bucket policy for CloudFront access (if needed)

### 2. Create CloudFront Distribution

1. Go to AWS CloudFront Console
2. Create a new distribution
3. Set origin to your S3 bucket
4. Configure caching and behaviors
5. Note your CloudFront domain (e.g., `d1234567890.cloudfront.net`)

### 3. Create IAM User

1. Go to AWS IAM Console
2. Create a new user with programmatic access
3. Attach the following policy (or create a custom policy):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

4. Save the Access Key ID and Secret Access Key

## Project Structure

```
media-cdn-manager/
├── app/
│   ├── api/
│   │   └── media/
│   │       ├── upload/
│   │       │   └── route.ts      # Upload endpoint
│   │       ├── list/
│   │       │   └── route.ts      # List files endpoint
│   │       └── delete/
│   │           └── route.ts      # Delete file endpoint
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page
│   └── globals.css               # Global styles
├── components/
│   └── MediaManager.tsx          # Main media manager component
├── lib/
│   └── s3.ts                     # S3 and CloudFront utilities
├── .env.example                  # Environment variables template
└── README.md                     # This file
```

## Usage

### Upload Files

1. Select a destination folder (Images, Documents, Videos, or Others)
2. Click "Select File" or drag and drop a file
3. Preview the file (if supported)
4. Click "Upload File"
5. Copy the CDN URL from the success message

### Manage Files

- **Filter**: Click on folder buttons to filter files by category
- **Copy URL**: Click "Copy" button on any file to copy its CDN URL
- **Delete**: Click "Delete" button to remove a file (with confirmation)

### File Categories

- **Images**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.avif`
- **Videos**: `.mp4`, `.webm`, `.ogg`, `.mov`, `.avi`, `.wmv`, `.flv`, `.mkv`
- **Documents**: All other file types
- **Others**: Files that don't match the above categories

## Configuration

### File Size Limit

Default file size limit is 50MB. To change this, edit `app/api/media/upload/route.ts`:

```typescript
const maxSize = 100 * 1024 * 1024 // 100MB
```

### Cache Control

Default cache control is set to 1 year. To change this, edit `lib/s3.ts`:

```typescript
CacheControl: 'max-age=31536000', // 1 year
```

## Deployment

### Vercel

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms

The application can be deployed to any platform that supports Next.js:
- AWS Amplify
- Netlify
- Railway
- DigitalOcean App Platform
- Self-hosted with Node.js

## Security Considerations

⚠️ **Important**: This application does not include authentication by design. If you need authentication:

1. Add authentication middleware to API routes
2. Implement user authentication (NextAuth.js, Clerk, etc.)
3. Add role-based access control if needed

For production use, consider:
- Adding rate limiting
- Implementing authentication
- Using environment variables for sensitive data
- Setting up CORS policies
- Implementing file type validation
- Adding virus scanning

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you encounter any issues or have questions, please open an issue on GitHub.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Powered by [AWS S3](https://aws.amazon.com/s3/) and [CloudFront](https://aws.amazon.com/cloudfront/)

---

Made with ❤️ for the open-source community
