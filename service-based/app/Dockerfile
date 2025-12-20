# Development-focused Dockerfile
FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package files
COPY package.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Default command for development
CMD ["npm", "run", "dev"]
