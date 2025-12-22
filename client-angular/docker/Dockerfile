# Stage 1: Build Angular app
FROM node:20 AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build for production
RUN npm run build -- --configuration=production

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Clean default Nginx html
RUN rm -rf /usr/share/nginx/html/*

# Copy Angular dist output
#COPY --from=build /app/dist/client-angular /usr/share/nginx/html
COPY --from=build /app/dist/client-angular/browser/. /usr/share/nginx/html/

# Copy custom Nginx config for Angular SPA routing
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
