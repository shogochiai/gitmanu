# 📱 GitManu

Mobile-friendly GitHub project upload service (especially for Mobile Vibe Coding with manus.im)

## 🌟 Features

- **📱 Mobile optimization**: Easy to use even on smartphones
- **🔐 GitHub OAuth**: Secure GitHub authentication system
- **📦 tar.gz support**: Automatically unpacks archive files and creates repositories
- **⚡ High-speed processing**: Efficient file processing and uploading
- **🛡️ Security**: Rate limiting, CORS, security headers
- **☁️ Cloud-compatible**: Easy deployment with Fly.io

## 🚀 Quick start

### 1. Clone the repository

```bash
git clone https://github.com/[username]/github-uploader.git
cd github-uploader
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set environment variables

```bash
cp .env.example .env
# Edit the .env file to configure GitHub OAuth settings
```

### 4. Create a GitHub OAuth App

1. Access [GitHub Developer Settings](https://github.com/settings/developers)
2. Click “New OAuth App”
3. Enter the following information:
   - **Application name**: GitHub Uploader
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/auth/github/callback`
4. Set the Client ID and Client Secret in the `.env` file

### 5. Start the development server

```bash
npm run dev
```

The application will start at `http://localhost:3000`.

## 🌐 Production deployment (Fly.io)

### Prerequisites

- [Fly.io](https://fly.io) account
- [flyctl CLI](https://fly.io/docs/hands-on/install-flyctl/) installed

### Deployment procedure

```bash
# Run the automatic deployment script
chmod +x deploy.sh
./deploy.sh
```

Or manual deployment:

```bash
# Fly.io login
flyctl auth login

# Create application
flyctl apps create github-uploader

# Set environment variables
flyctl secrets set GITHUB_CLIENT_ID=your_client_id
flyctl secrets set GITHUB_CLIENT_SECRET=your_client_secret
flyctl secrets set JWT_SECRET=your_jwt_secret

# Deploy
flyctl deploy
```

## 📖 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|---------|---------------|------|
| GET | `/auth/github` | Start GitHub OAuth authentication |
| GET | `/auth/github/callback` | OAuth callback |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/status` | Check authentication status |
| GET | `/api/auth/profile` | Get user profile |

### Upload Endpoints

| Method | Endpoint | Description |
|---------|---------------|------|
| POST | `/api/upload` | File Upload & Repository Creation |
| GET | `/api/upload/repositories` | User Repository List |

### System Endpoints

| Method | Endpoint | Description |
|---------|---------------|------|
| GET | `/health` | Health Check |
| GET | `/api` | API Information |

## 🔧 Settings

### Environment Variables

| Variable Name | Description | Default |
|--------|------|-----------|
| `NODE_ENV` | Execution Environment | `development` |
| `PORT` | Port Number | `3000` |
| `BASE_URL` | Base URL | `http://localhost:3000` |
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID | - |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret | - |
| `JWT_SECRET` | JWT signing secret key | - |
| `MAX_FILE_SIZE` | Maximum file size (bytes) | `104857600` (100MB) |
| `MAX_FILES_PER_ARCHIVE` | Maximum number of files per archive | `10000` |

### File restrictions

- **Supported formats**: `.tar.gz`, `.tgz`
- **Maximum file size**: 100MB
- **Maximum number of files**: 10,000 files
- **Supported file types**: Source code, configuration files, documents, small images

## 📱 How to use

### 1. Log in

1. Access the application
2. Click the “Log in with GitHub” button
3. Complete GitHub authentication

### 2. Upload project

1. Select the tar.gz file using “Select file”
2. Enter the project name and description
3. Select private/public settings
4. Click the “Upload” button

### 3. Confirm results

- After the upload is complete, the GitHub repository URL will be displayed
- README.md will be automatically generated (if it does not already exist)

## 🛡️ Security

- **OAuth authentication**: Uses official GitHub OAuth
- **CSRF protection**: Verification using state parameters
- **Rate limiting**: Prevents API abuse
- **File verification**: Excludes unsafe files
- **Path traversal prevention**: Prevents access outside the directory

## 🧪 Testing

```bash
# Run unit tests
npm test

# Tests with coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

## 📊 Monitoring

### Health check

```bash
curl http://localhost:3000/health
```

### Log check (Fly.io)

```bash
flyctl logs --app github-uploader
```

### Metrics

- Number of requests
- Response time
- Error rate
- Upload success rate

## 🤝 Contributions

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Create a pull request

## 📄 License

This project is released under the MIT License. For details, refer to the [LICENSE](LICENSE) file.

## 🆘 Support

If you encounter any issues, you can receive support in the following ways:

- Report bugs or request features via [Issues](https://github.com/[username]/github-uploader/issues)
- Ask questions or discuss via [Discussions](https://github.com/[username]/github-uploader/discussions)

## 🙏 Acknowledgments

- [Hono](https://hono.dev/) - A high-speed web framework
- [Fly.io](https://fly.io/) - An excellent cloud platform
- [GitHub API](https://docs.github.com/en/rest) - A powerful API

---

**📱 Easily upload GitHub projects from your mobile device!**



Translated with DeepL.com (free version)
