# Docker部署离线HTML文件到阿里云服务器

## 目录

- [概述](#概述)
- [架构说明](#架构说明)
- [首次部署](#首次部署)
- [日常部署](#日常部署)
- [配置说明](#配置说明)
- [故障排查](#故障排查)
- [成本估算](#成本估算)

## 概述

本方案使用Docker容器化部署，将离线HTML文件部署到阿里云服务器，提供HTTPS公网访问能力。

### 核心特性

- **智能分离**：根据文件大小自动选择Base64内嵌或分离模式
- **一键部署**：自动化脚本完成所有部署步骤
- **多文件管理**：支持同时在线多个HTML文件
- **HTTPS访问**：自动配置SSL证书
- **流式传输**：支持音视频流式播放
- **CDN缓存**：优化加载性能

### 文件结构

```
项目根目录/
├── Dockerfile                    # Docker镜像配置
├── docker-compose.yml            # Docker编排配置
├── nginx.conf                    # Nginx服务器配置
├── js/
│   └── offline-exporter-v2.js   # 升级版离线导出功能
├── generate-offline-html.js      # HTML生成脚本
├── deploy.sh                     # 自动化部署脚本
├── html/                         # HTML文件目录（自动创建）
├── media/                        # 媒体文件目录（自动创建）
├── ssl/                          # SSL证书目录（需手动创建）
├── logs/                         # 日志目录（自动创建）
└── mapping.json                  # 文件映射关系（自动生成）
```

## 架构说明

### 系统架构

```
┌─────────────────────────────────────────────────┐
│         阿里云ECS服务器                  │
│  ┌─────────────────────────────────────┐    │
│  │ Docker容器                        │    │
│  │  ┌───────────────────────────┐    │    │
│  │  │ Nginx Web服务器        │    │    │
│  │  └───────────────────────────┘    │    │
│  │                                 │    │
│  │  ┌──────────┐  ┌─────────────┐ │    │
│  │  │ HTML目录  │  │ Media目录   │ │    │
│  │  │ /html    │  │ /media     │ │    │
│  │  └──────────┘  └─────────────┘ │    │
│  └─────────────────────────────────────┘    │
│                                         │
│  HTTPS:443 ←→ 公网访问                │
└─────────────────────────────────────────────────┘
```

### 智能分离策略

| 文件大小 | 模式 | HTML大小 | 媒体处理 |
|---------|------|---------|----------|
| < 20MB | Base64内嵌 | 5-15MB | 内嵌到HTML |
| > 20MB | 分离模式 | 500KB-2MB | 外部文件 |

### 访问方式

```
单个文件访问：
https://your-domain.com/html/offline-asr-2024-01-18-10-30-00.html

查看所有文件：
https://your-domain.com/html/

查看映射关系：
https://your-domain.com/api/mapping

健康检查：
https://your-domain.com/health
```

## 首次部署

### 前置要求

- 阿里云ECS服务器（推荐配置：2核4GB）
- 域名（已解析到服务器IP）
- SSH访问权限
- Node.js环境（本地）

### 步骤1：购买和配置阿里云ECS

1. **购买ECS实例**
   - 登录阿里云控制台
   - 选择ECS → 创建实例
   - 推荐配置：
     - 实例规格：2核4GB
     - 操作系统：Ubuntu 20.04 LTS
     - 带宽：5Mbps
     - 系统盘：40GB SSD

2. **配置安全组**
   - 开放端口：80（HTTP）、443（HTTPS）、22（SSH）
   - 入方向规则：
     - 端口：22/22，授权对象：0.0.0.0/0
     - 端口：80/80，授权对象：0.0.0.0/0
     - 端口：443/443，授权对象：0.0.0.0/0

3. **配置域名DNS**
   - 登录域名服务商控制台
   - 添加A记录：
     - 主机记录：@ 或 www
     - 记录值：服务器公网IP
     - TTL：600

### 步骤2：配置服务器环境

```bash
# SSH登录服务器
ssh root@your-server-ip

# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version

# 创建部署目录
sudo mkdir -p /opt/offline-html
cd /opt/offline-html

# 创建子目录
sudo mkdir -p html media ssl logs

# 设置权限
sudo chown -R $USER:$USER /opt/offline-html
```

### 步骤3：配置SSL证书

#### 方案A：使用Let's Encrypt（推荐，免费）

```bash
# 安装Certbot
sudo apt install -y certbot

# 获取SSL证书
sudo certbot certonly --standalone -d your-domain.com

# 复制证书到项目目录
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/offline-html/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/offline-html/ssl/key.pem

# 设置权限
sudo chmod 644 /opt/offline-html/ssl/cert.pem
sudo chmod 600 /opt/offline-html/ssl/key.pem
```

#### 方案B：使用自签名证书（测试用）

```bash
# 生成自签名证书
cd /opt/offline-html/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem \
  -out cert.pem \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=MyOrg/CN=your-domain.com"
```

### 步骤4：上传配置文件

```bash
# 在本地项目目录执行
scp Dockerfile docker-compose.yml nginx.conf \
  root@your-server-ip:/opt/offline-html/
```

### 步骤5：修改配置文件

#### 修改nginx.conf

```bash
# 在服务器上编辑
ssh root@your-server-ip
cd /opt/offline-html
nano nginx.conf
```

将 `your-domain.com` 替换为你的实际域名：

```nginx
server_name your-domain.com;
```

#### 修改docker-compose.yml

```bash
nano docker-compose.yml
```

确保volumes配置正确：

```yaml
volumes:
  - ./html:/var/www/html:ro
  - ./media:/var/www/media:ro
  - ./mapping.json:/var/www/mapping/mapping.json:ro
  - ./ssl:/etc/nginx/ssl:ro
  - ./logs:/var/log/nginx
```

### 步骤6：启动Docker容器

```bash
# 构建并启动容器
cd /opt/offline-html
docker-compose up -d

# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 步骤7：验证部署

```bash
# 健康检查
curl https://your-domain.com/health

# 应该返回：healthy
```

在浏览器中访问：
- `https://your-domain.com/health` - 健康检查
- `https://your-domain.com/html/` - HTML文件列表

## 日常部署

### 步骤1：配置部署脚本

在本地项目目录编辑 `deploy.sh`：

```bash
nano deploy.sh
```

修改以下配置：

```bash
SERVER_USER="root"                    # SSH用户名
SERVER_HOST="your-server-ip"          # 服务器IP
DEPLOY_DIR="/opt/offline-html"        # 部署目录
DOMAIN="your-domain.com"              # 域名
```

### 步骤2：配置离线导出功能

编辑 `js/offline-exporter-v2.js`：

```bash
nano js/offline-exporter-v2.js
```

修改服务器配置：

```javascript
config: {
    separateThreshold: 20 * 1024 * 1024,
    serverConfig: {
        baseUrl: 'https://your-domain.com',
        htmlPath: '/html',
        mediaPath: '/media'
    }
}
```

### 步骤3：生成并部署HTML文件

```bash
# 方式1：使用示例数据
node generate-offline-html.js

# 方式2：使用实际数据（需要修改generate-offline-html.js）
# 编辑generate-offline-html.js，修改record对象
nano generate-offline-html.js
node generate-offline-html.js

# 自动部署
./deploy.sh
```

### 步骤4：访问部署的文件

部署成功后，会显示访问地址：

```
访问地址: https://your-domain.com/html/offline-asr-2024-01-18-10-30-00.html
查看所有文件: https://your-domain.com/html/
查看映射关系: https://your-domain.com/api/mapping
```

### 步骤5：管理多个文件

每次部署新文件时，脚本会自动：

1. 生成新的HTML文件
2. 如果文件较大，自动分离媒体文件
3. 更新mapping.json映射文件
4. 上传到服务器
5. 重启Docker容器

所有文件都会保留在服务器上，可以通过以下方式访问：

```
https://your-domain.com/html/offline-asr-2024-01-18-10-30-00.html
https://your-domain.com/html/offline-tts-2024-01-18-11-00-00.html
https://your-domain.com/html/offline-asr-2024-01-18-12-00-00.html
```

## 配置说明

### Nginx配置详解

#### HTML文件配置

```nginx
location /html/ {
    alias /var/www/html/;
    autoindex on;
    autoindex_exact_size on;
    autoindex_localtime on;
    
    expires 1h;
    add_header Cache-Control "public, max-age=3600";
}
```

- `autoindex on`：启用目录列表
- `expires 1h`：缓存1小时

#### 媒体文件配置

```nginx
location /media/ {
    alias /var/www/media/;
    
    mp4;
    mp4_buffer_size 1m;
    mp4_max_buffer_size 5m;
    
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
    
    add_header Access-Control-Allow-Origin *;
}
```

- `mp4`：启用MP4流式传输
- `expires 30d`：缓存30天
- CORS配置：允许跨域访问

### Docker Compose配置详解

```yaml
services:
  web:
    build: .
    container_name: offline-html-server
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./html:/var/www/html:ro
      - ./media:/var/www/media:ro
      - ./mapping.json:/var/www/mapping/mapping.json:ro
      - ./ssl:/etc/nginx/ssl:ro
      - ./logs:/var/log/nginx
    environment:
      - TZ=Asia/Shanghai
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

- `restart: unless-stopped`：自动重启
- `volumes:ro`：只读挂载，提高安全性
- `healthcheck`：健康检查

## 故障排查

### 问题1：容器无法启动

**症状：**
```bash
docker-compose ps
# 显示 Exit 1 或 Restarting
```

**解决方案：**

```bash
# 查看详细日志
docker-compose logs

# 检查配置文件
docker-compose config

# 检查端口占用
sudo netstat -tlnp | grep -E ':(80|443)'

# 重启容器
docker-compose down
docker-compose up -d
```

### 问题2：SSL证书错误

**症状：**
浏览器显示"连接不安全"或证书错误

**解决方案：**

```bash
# 检查证书文件
ls -la /opt/offline-html/ssl/

# 检查证书有效期
openssl x509 -in /opt/offline-html/ssl/cert.pem -noout -dates

# 重新获取证书
sudo certbot certonly --standalone -d your-domain.com
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/offline-html/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/offline-html/ssl/key.pem

# 重启容器
cd /opt/offline-html
docker-compose restart
```

### 问题3：文件上传失败

**症状：**
```
错误：文件上传失败
```

**解决方案：**

```bash
# 检查SSH连接
ssh root@your-server-ip "echo 'SSH连接成功'"

# 检查目录权限
ssh root@your-server-ip "ls -la /opt/offline-html/"

# 检查磁盘空间
ssh root@your-server-ip "df -h"

# 手动上传测试
scp test.html root@your-server-ip:/opt/offline-html/html/
```

### 问题4：健康检查失败

**症状：**
```
健康检查失败，HTTP状态码: 000
```

**解决方案：**

```bash
# 检查DNS解析
nslookup your-domain.com

# 检查防火墙
sudo ufw status

# 检查Nginx配置
docker-compose exec web nginx -t

# 检查容器日志
docker-compose logs web

# 测试本地访问
curl http://localhost/health
curl https://localhost/health
```

### 问题5：媒体文件无法播放

**症状：**
音频/视频无法播放或加载缓慢

**解决方案：**

```bash
# 检查媒体文件
ls -lh /opt/offline-html/media/

# 检查文件权限
chmod 644 /opt/offline-html/media/*

# 检查Nginx媒体配置
docker-compose exec web cat /etc/nginx/nginx.conf | grep -A 20 "location /media/"

# 测试媒体文件访问
curl -I https://your-domain.com/media/audio1.mp3

# 检查浏览器控制台错误
# F12 → Console → 查看错误信息
```

### 问题6：Docker容器占用过多资源

**症状：**
服务器CPU或内存占用过高

**解决方案：**

```bash
# 查看容器资源使用
docker stats

# 限制容器资源
# 编辑docker-compose.yml，添加：
# deploy:
#   resources:
#     limits:
#       cpus: '1'
#       memory: 512M

# 重启容器
docker-compose down
docker-compose up -d
```

## 成本估算

### 阿里云ECS成本

| 配置 | 月成本 | 适用场景 |
|------|--------|----------|
| 1核2GB | 60-80元 | <1000次/天 |
| 2核4GB | 120-150元 | 1000-5000次/天 |
| 4核8GB | 250-300元 | >5000次/天 |

### 带宽成本

| 带宽 | 月成本 | 适用场景 |
|------|--------|----------|
| 1Mbps | 30元 | 小流量 |
| 5Mbps | 100元 | 中流量（推荐） |
| 10Mbps | 200元 | 大流量 |

### 总成本

**推荐配置（2核4GB + 5Mbps）：**
- 服务器：120-150元/月
- 带宽：100元/月
- **总计：220-250元/月**

### 优化建议

1. **使用按流量计费**：如果访问量波动大，可以考虑按流量计费
2. **启用CDN**：对于大流量场景，可以配置阿里云CDN
3. **定期清理**：定期清理旧的HTML和媒体文件
4. **压缩优化**：对媒体文件进行压缩优化

## 维护建议

### 定期任务

1. **每周**
   - 检查容器状态
   - 查看日志文件
   - 清理无用文件

2. **每月**
   - 更新SSL证书（Let's Encrypt自动续期）
   - 检查磁盘空间
   - 备份重要数据

3. **每季度**
   - 更新Docker镜像
   - 优化Nginx配置
   - 评估成本和性能

### 备份策略

```bash
# 备份HTML和媒体文件
tar -czf backup-$(date +%Y%m%d).tar.gz html/ media/ mapping.json

# 备份到云存储
# 可以使用阿里云OSS或其他云存储服务
```

### 监控建议

1. **监控指标**
   - 容器状态
   - 磁盘使用率
   - 网络流量
   - 响应时间

2. **告警设置**
   - 容器异常退出
   - 磁盘空间不足
   - 健康检查失败

## 总结

本方案提供了一个完整的Docker化部署解决方案，具有以下优势：

- ✅ 部署简单，一键完成
- ✅ 智能分离，优化性能
- ✅ 多文件管理，灵活扩展
- ✅ HTTPS访问，安全可靠
- ✅ 成本可控，适合长期运营

如有问题，请参考故障排查部分或联系技术支持。