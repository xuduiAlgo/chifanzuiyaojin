# 吃饭要紧 - 外部部署指南

本指南提供多种外部部署方案，帮助你将应用部署到生产环境。

## 目录

- [部署前准备](#部署前准备)
- [方案一：云服务器部署](#方案一云服务器部署)
- [方案二：本地服务器部署](#方案二本地服务器部署)
- [方案三：Nginx反向代理部署](#方案三nginx反向代理部署)
- [方案四：云平台PaaS部署](#方案四云平台paas部署)
- [安全配置](#安全配置)
- [监控与维护](#监控与维护)
- [故障排查](#故障排查)

---

## 部署前准备

### 1. 系统要求

- **操作系统**：Linux (Ubuntu 20.04+ / CentOS 7+ / Debian 10+) / macOS / Windows
- **内存**：最少 2GB，推荐 4GB+
- **磁盘**：最少 10GB，推荐 20GB+
- **CPU**：最少 2 核，推荐 4 核+

### 2. 必需软件

- **Python**: 3.11+
- **pip**: Python包管理器
- **Git**: 用于代码管理（可选）
- **Nginx**（可选）：反向代理

### 3. 环境变量配置

创建 `.env` 文件：

```bash
# 阿里云DashScope API密钥（必需）
DASHSCOPE_API_KEY=your_dashscope_api_key_here

# 可选配置
PORT=5173
LOG_LEVEL=info
PYTHONUNBUFFERED=1
```

**重要**：
- `DASHSCOPE_API_KEY` 是必需的，从 [阿里云DashScope控制台](https://dashscope.console.aliyun.com/) 获取
- 建议开启"按量付费"以避免免费额度耗尽

---

## 方案一：云服务器部署

### 1. 购买云服务器

推荐平台：
- **阿里云 ECS**
- **腾讯云 CVM**
- **华为云 ECS**
- **DigitalOcean**
- **Linode**

### 2. 服务器初始化

```bash
# 更新系统（Ubuntu/Debian）
sudo apt update && sudo apt upgrade -y

# 安装必要工具
sudo apt install -y curl git python3 python3-pip python3-venv

# 配置防火墙（Ubuntu）
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5173/tcp
sudo ufw enable
```

### 3. 部署应用

```bash
# 克隆代码
cd /opt
sudo git clone https://github.com/xuduiAlgo/chifanzuiyaojin.git
cd chifanzuiyaojin

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
sudo cp .env.example .env  # 如果有示例文件
sudo nano .env  # 编辑并填入API密钥

# 创建必要的目录
mkdir -p tts_output logs temp

# 启动服务器
python server.py
```

### 4. 使用系统服务（推荐）

创建 systemd 服务文件：

```bash
sudo nano /etc/systemd/system/chifanzuiyaojin.service
```

内容：

```ini
[Unit]
Description=Chifanzuiyaojin Web Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/chifanzuiyaojin
Environment="PATH=/opt/chifanzuiyaojin/venv/bin"
ExecStart=/opt/chifanzuiyaojin/venv/bin/python server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
# 重新加载systemd
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start chifanzuiyaojin

# 设置开机自启
sudo systemctl enable chifanzuiyaojin

# 查看状态
sudo systemctl status chifanzuiyaojin

# 查看日志
sudo journalctl -u chifanzuiyaojin -f
```

### 5. 验证部署

```bash
# 测试健康检查
curl http://localhost:5173/health

# 测试API
curl http://localhost:5173/api/get-config

# 从外部测试
curl http://your_server_ip:5173/health
```

---

## 方案二：本地服务器部署

### 1. macOS 部署

```bash
# 安装Homebrew（如果未安装）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装Python
brew install python3

# 克隆代码
cd ~/Documents
git clone https://github.com/xuduiAlgo/chifanzuiyaojin.git
cd chifanzuiyaojin

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
nano .env

# 创建必要的目录
mkdir -p tts_output logs temp

# 启动服务器
python server.py
```

### 2. Windows 部署

```powershell
# 安装Python
# 从 https://www.python.org/downloads/ 下载安装

# 克隆代码
cd C:\
git clone https://github.com/xuduiAlgo/chifanzuiyaojin.git
cd chifanzuiyaojin

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
notepad .env

# 创建必要的目录
mkdir tts_output, logs, temp

# 启动服务器
python server.py
```

### 3. Linux 本地部署

```bash
# 克隆代码
cd ~
git clone https://github.com/xuduiAlgo/chifanzuiyaojin.git
cd chifanzuiyaojin

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
nano .env

# 创建必要的目录
mkdir -p tts_output logs temp

# 启动服务器
python server.py
```

---

## 方案三：Nginx反向代理部署

### 1. 安装Nginx

```bash
# Ubuntu/Debian
sudo apt install -y nginx

# CentOS/RHEL
sudo yum install -y nginx

# macOS
brew install nginx

# 启动Nginx
sudo systemctl start nginx  # Linux
sudo nginx                 # macOS
```

### 2. 配置Nginx

创建配置文件：

```bash
sudo nano /etc/nginx/sites-available/chifanzuiyaojin  # Ubuntu/Debian
# 或
sudo nano /etc/nginx/conf.d/chifanzuiyaojin.conf  # CentOS/RHEL
```

内容：

```nginx
# HTTP重定向到HTTPS
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS配置
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL证书配置
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL优化
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 客户端上传限制
    client_max_body_size 100M;

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /opt/chifanzuiyaojin;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 代理配置
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    # 健康检查
    location /health {
        proxy_pass http://127.0.0.1:5173/health;
        access_log off;
    }
}
```

### 3. 启用配置

```bash
# 创建符号链接（Ubuntu/Debian）
sudo ln -s /etc/nginx/sites-available/chifanzuiyaojin /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx

# 查看状态
sudo systemctl status nginx
```

### 4. 获取SSL证书

使用Let's Encrypt免费证书：

```bash
# 安装certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书（需要先配置DNS解析）
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

---

## 方案四：云平台PaaS部署

### 1. Render.com

```yaml
# render.yaml
services:
  - type: web
    name: chifanzuiyaojin
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: python server.py
    plan: free
    envVars:
      - key: PORT
        value: 10000
      - key: DASHSCOPE_API_KEY
        sync: false
    healthCheckPath: /health
```

### 2. Railway.app

```bash
# 安装Railway CLI
npm install -g @railway/cli

# 登录
railway login

# 初始化项目
railway init

# 添加变量
railway variables set DASHSCOPE_API_KEY=your_key
railway variables set PORT=5173

# 部署
railway up
```

### 3. Heroku

```bash
# 安装Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# 登录
heroku login

# 创建应用
heroku create chifanzuiyaojin

# 设置环境变量
heroku config:set DASHSCOPE_API_KEY=your_key
heroku config:set PORT=5173

# 创建Procfile
echo "web: python server.py" > Procfile

# 部署
git push heroku main
```

### 4. Vercel

```bash
# 安装Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel
```

创建 `vercel.json`：

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/server.py"
    }
  ]
}
```

---

## 安全配置

### 1. 环境变量保护

```bash
# 设置文件权限
chmod 600 .env

# 确保不会被提交到Git
echo ".env" >> .gitignore
```

### 2. 防火墙配置

```bash
# 只允许必要端口（Ubuntu UFW）
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5173/tcp  # 如果直接访问
sudo ufw enable
```

### 3. 限制访问

在Nginx配置中添加IP白名单：

```nginx
location /api/ {
    allow 1.2.3.4;  # 你的IP
    deny all;
    proxy_pass http://127.0.0.1:5173;
}
```

### 4. 使用HTTPS

始终使用HTTPS来保护数据传输安全。参考方案三中的SSL证书配置。

### 5. 定期更新

```bash
# 定期更新依赖
pip install --upgrade -r requirements.txt

# 定期更新系统
sudo apt update && sudo apt upgrade -y
```

---

## 监控与维护

### 1. 日志管理

```bash
# 查看应用日志
tail -f logs/server.log

# 查看系统服务日志
sudo journalctl -u chifanzuiyaojin -f

# 配置日志轮转
sudo nano /etc/logrotate.d/chifanzuiyaojin
```

内容：

```
/opt/chifanzuiyaojin/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 www-data www-data
}
```

### 2. 资源监控

```bash
# 查看系统资源
htop

# 查看Python进程资源
ps aux | grep python

# 查看端口占用
sudo netstat -tlnp | grep 5173
```

### 3. 健康检查

创建健康检查脚本：

```bash
#!/bin/bash
# health-check.sh

URL="http://localhost:5173/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $URL)

if [ $RESPONSE -eq 200 ]; then
    echo "✓ Service is healthy"
    exit 0
else
    echo "✗ Service is unhealthy (HTTP $RESPONSE)"
    # 重启服务
    sudo systemctl restart chifanzuiyaojin
    exit 1
fi
```

添加到crontab：

```bash
# 每5分钟检查一次
crontab -e
*/5 * * * * /opt/chifanzuiyaojin/scripts/health-check.sh >> /var/log/chifanzuiyaojin-health.log 2>&1
```

---

## 性能优化

### 1. 使用Gunicorn（生产环境推荐）

安装Gunicorn：

```bash
pip install gunicorn
```

修改启动命令：

```bash
# 使用4个worker进程
gunicorn --bind 0.0.0.0:5173 --workers 4 --threads 2 --timeout 120 server:app
```

更新systemd服务文件：

```ini
[Unit]
Description=Chifanzuiyaojin Web Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/chifanzuiyaojin
Environment="PATH=/opt/chifanzuiyaojin/venv/bin"
ExecStart=/opt/chifanzuiyaojin/venv/bin/gunicorn --bind 0.0.0.0:5173 --workers 4 --threads 2 --timeout 120 server:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 2. 静态资源缓存

在Nginx配置中添加缓存（见方案三）。

### 3. 使用CDN

将静态文件上传到CDN（如阿里云OSS、腾讯云COS、Cloudflare）。

---

## 备份策略

### 1. 数据备份

```bash
# 备份tts_output目录
tar -czf tts_backup_$(date +%Y%m%d).tar.gz tts_output/

# 备份历史记录
cp history.json history_backup_$(date +%Y%m%d).json

# 备份配置文件
cp .env .env.backup
```

### 2. 自动备份脚本

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/opt/backups/chifanzuiyaojin"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份数据
tar -czf $BACKUP_DIR/tts_$DATE.tar.gz /opt/chifanzuiyaojin/tts_output
cp /opt/chifanzuiyaojin/history.json $BACKUP_DIR/history_$DATE.json

# 删除30天前的备份
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
find $BACKUP_DIR -name "history_*.json" -mtime +30 -delete

echo "Backup completed: $DATE"
```

### 3. 定时任务

```bash
# 添加到crontab
crontab -e

# 每天凌晨3点备份
0 3 * * * /opt/chifanzuiyaojin/scripts/backup.sh >> /var/log/chifanzuiyaojin-backup.log 2>&1
```

---

## 故障排查

### 1. 服务无法启动

```bash
# 查看详细错误
python server.py

# 检查端口占用
sudo netstat -tlnp | grep 5173

# 检查日志
tail -f logs/server.log
```

### 2. API调用失败

```bash
# 检查API密钥
cat .env | grep DASHSCOPE

# 测试网络连接
ping dashscope.aliyuncs.com

# 查看详细错误日志
tail -f logs/server.log | grep -i error
```

### 3. 性能问题

```bash
# 查看系统资源
htop

# 检查磁盘空间
df -h

# 查看Python进程
ps aux | grep python
```

### 4. 权限问题

```bash
# 修改目录权限
sudo chown -R www-data:www-data /opt/chifanzuiyaojin
sudo chmod -R 755 /opt/chifanzuiyaojin

# 修改日志目录权限
sudo chmod -R 777 /opt/chifanzuiyaojin/logs
```

---

## 常见问题 FAQ

### Q1: 免费额度耗尽怎么办？

**A**: 前往[阿里云DashScope控制台](https://dashscope.console.aliyun.com/)开启"按量付费"或购买资源包。

### Q2: 如何更新到最新版本？

```bash
cd /opt/chifanzuiyaojin
git pull
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart chifanzuiyaojin
```

### Q3: 支持多用户访问吗？

**A**: 当前版本支持多用户同时访问，但历史记录是全局共享的。如需多用户隔离，需要添加用户认证系统。

### Q4: 可以部署到内网吗？

**A**: 可以，但需要确保：
- 内网可以访问阿里云API
- 客户端可以访问服务器IP和端口

### Q5: 如何查看API调用统计？

**A**: 登录阿里云控制台的DashScope服务查看调用次数和费用。

### Q6: 如何修改端口？

**A**: 修改 `.env` 文件中的 `PORT` 变量，然后重启服务。

---

## 外部访问配置

### 局域网访问

1. 确保服务器监听 `0.0.0.0`（server.py中已配置）
2. 获取服务器IP地址：
   ```bash
   # Linux/macOS
   ifconfig | grep "inet "
   
   # 或
   ip addr show
   ```
3. 从局域网其他设备访问：`http://服务器IP:5173`

### 互联网访问

如果需要从互联网访问，需要：

1. **获取公网IP**
   ```bash
   curl ifconfig.me
   ```

2. **配置路由器端口转发**
   - 登录路由器管理界面
   - 找到"虚拟服务器"或"端口映射"
   - 添加规则：
     - 内部IP：服务器局域网IP
     - 内部端口：5173
     - 外部端口：5173
     - 协议：TCP

3. **使用DDNS服务**（如果公网IP动态变化）
   - No-IP
   - DuckDNS
   - 花生壳

**⚠️ 安全警告**：
直接暴露公网IP存在安全风险，建议：
- 配置HTTPS
- 使用防火墙限制访问
- 考虑使用VPN

---

## 联系支持

- **GitHub Issues**: https://github.com/xuduiAlgo/chifanzuiyaojin/issues
- **文档**: https://github.com/xuduiAlgo/chifanzuiyaojin/tree/main/docs

---

## 许可证

MIT License - 详见 [LICENSE](../LICENSE) 文件
