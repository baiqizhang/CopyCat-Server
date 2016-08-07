FROM node:latest

WORKDIR /workspace
ADD package.json /workspace
RUN npm install
ADD . /workspace

# Expose port
EXPOSE 3001

# Run app using nodemon
CMD ["npm", "start"]
