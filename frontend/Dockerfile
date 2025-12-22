# Frontend Dockerfile
FROM node:20-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 3000

# 开发模式启动
CMD ["npm", "run", "dev"]


