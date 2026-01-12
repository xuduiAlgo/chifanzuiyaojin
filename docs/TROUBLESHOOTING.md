# 吃饭要紧 - 故障排查指南

本文档帮助解决使用和部署过程中常见的问题。

---

## 目录

- [安装问题](#安装问题)
- [启动问题](#启动问题)
- [API调用失败](#api调用失败)
- [网络问题](#网络问题)
- [性能问题](#性能问题)
- [权限问题](#权限问题)
- [外部访问问题](#外部访问问题)
- [常见错误](#常见错误)

---

## 安装问题

### 问题：Python版本不兼容

**错误信息：**
```
SyntaxError: invalid syntax
```

**解决方案：**

```bash
# 检查Python版本
python --version
# 需要 3.11+ 

# 如果版本过低，安装新版本
# Ubuntu/Debian
sudo apt update
sudo apt install python3.11 python3.11-venv

# macOS
brew install python3.11

# Windows
# 从 https://www.python.org/downloads/ 下载安装
```

### 问题：pip安装依赖失败

**错误信息：**
```
ERROR: Could not find a version that satisfies the requirement
```

**解决方案：**

#### 使用国内pip源

```bash
# 临时使用
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 永久配置
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
```

#### 更新pip

```bash
python -m pip install --upgrade pip
```

#### 逐个安装依赖

```bash
# 查看哪个包安装失败
pip install -r requirements.txt -v

# 单独安装失败的包
pip install edge-tts dashscope flask
```

### 问题：缺少系统依赖

**错误信息：**
```
error: Microsoft Visual C++ 14.0 is required
```

**解决方案：**

**Linux:**
```bash
sudo apt install build-essential python3-dev
```

**macOS:**
```bash
xcode-select --install
```

**Windows:**
- 安装 Visual Studio Build Tools
- 下载地址：https://visualstudio.microsoft.com/downloads/

---

## 启动问题

### 问题：端口被占用

**错误信息：**
```
OSError: [Errno 48] Address already in use
```

**解决方案：**

```bash
# 查找占用端口的进程
# Linux/macOS
lsof -i :5173
# 或
sudo netstat -tlnp | grep 5173

# Windows
netstat -ano | findstr :5173

# 终止进程
kill -9 <PID>  # Linux/macOS
taskkill /PID <PID> /F  # Windows

# 或修改端口
# 编辑 .env 文件
PORT=8080
```

### 问题：环境变量未配置

**错误信息：**
```
KeyError: 'DASHSCOPE_API_KEY'
```

**解决方案：**

```bash
# 创建 .env 文件
cat > .env << EOF
DASHSCOPE_API_KEY=your_actual_api_key_here
PORT=5173
LOG_LEVEL=info
EOF

# 设置文件权限
chmod 600 .env

# 验证
cat .env
```

### 问题：缺少必要的目录

**错误信息：**
```
FileNotFoundError: [Errno 2] No such file or directory
```

**解决方案：**

```bash
# 创建必要的目录
mkdir -p tts_output logs temp

# 验证权限
ls -la

# 设置权限（Linux/macOS）
chmod 755 tts_output logs temp
```

---

## API调用失败

### 问题：API密钥未配置或无效

**错误信息：**
```
InvalidApiKey
The API key is invalid or expired
```

**解决方案：**

1. **获取正确的API密钥**
   - 访问 [阿里云DashScope控制台](https://dashscope.console.aliyun.com/)
   - 登录并创建API Key
   - 复制API密钥

2. **配置环境变量**
   ```bash
   # 编辑 .env 文件
   nano .env
   
   # 填入正确的API密钥
   DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. **验证配置**
   ```bash
   # 测试API连接
   python -c "import os; from dotenv import load_dotenv; load_dotenv(); print(os.getenv('DASHSCOPE_API_KEY'))"
   ```

### 问题：免费额度耗尽

**错误信息：**
```
AllocationQuota.FreeTierOnly
free tier of the model has been exhausted
```

**解决方案：**

1. **登录阿里云控制台**
   - 访问 https://dashscope.console.aliyun.com/
   - 查看剩余额度和使用情况

2. **开启按量付费**
   - 进入"费用中心"
   - 开通"按量付费"
   - 设置告警阈值

3. **购买资源包**（推荐）
   - 根据使用量购买合适的资源包
   - 相比按量付费更经济

### 问题：网络连接超时

**错误信息：**
```
ConnectionError
Timeout
requests.exceptions.Timeout
```

**解决方案：**

```bash
# 测试网络连接
ping dashscope.aliyuncs.com

# 测试DNS解析
nslookup dashscope.aliyuncs.com

# 测试API连接
curl -I https://dashscope.aliyuncs.com

# 检查代理设置（如果使用）
echo $HTTP_PROXY
echo $HTTPS_PROXY

# 临时禁用代理
unset HTTP_PROXY
unset HTTPS_PROXY
```

### 问题：API返回错误

**错误信息：**
```
{"code":"InvalidParameter","message":"Invalid request parameter"}
```

**解决方案：**

```bash
# 查看详细日志
tail -f logs/server.log

# 检查请求参数
# 在浏览器开发者工具中查看Network标签

# 验证请求格式
curl -X POST http://localhost:5173/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"测试","voice":"zh-CN-XiaoxiaoNeural"}'
```

---

## 网络问题

### 问题：无法访问本地服务器

**错误信息：**
```
This site can't be reached
```

**解决方案：**

```bash
# 检查服务是否运行
ps aux | grep python

# 检查端口监听
netstat -tlnp | grep 5173

# 检查防火墙
# Linux (Ubuntu)
sudo ufw status
sudo ufw allow 5173/tcp

# Linux (CentOS)
sudo firewall-cmd --list-all
sudo firewall-cmd --add-port=5173/tcp --permanent
sudo firewall-cmd --reload

# macOS
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
# 如果防火墙启用，需要在设置中允许Python
```

### 问题：局域网其他设备无法访问

**解决方案：**

```bash
# 1. 检查服务器监听地址
# 确保 server.py 中监听的是 0.0.0.0 而不是 127.0.0.1

# 2. 获取服务器IP地址
ifconfig | grep "inet "
# 或
ip addr show

# 3. 测试局域网访问
curl http://服务器IP:5173/health

# 4. 检查防火墙
sudo ufw allow from 192.168.0.0/16 to any port 5173
```

### 问题：外网无法访问

**解决方案：**

```bash
# 1. 获取公网IP
curl ifconfig.me

# 2. 配置路由器端口转发
# 登录路由器管理界面
# 找到"虚拟服务器"或"端口映射"
# 添加规则：
#   - 内部IP：服务器局域网IP
#   - 内部端口：5173
#   - 外部端口：5173
#   - 协议：TCP

# 3. 测试外网访问
curl http://公网IP:5173/health
```

---

## 性能问题

### 问题：响应速度慢

**原因分析：**

```bash
# 查看CPU使用情况
top
# 或
htop

# 查看内存使用
free -h

# 查看Python进程资源
ps aux | grep python
```

**解决方案：**

```bash
# 1. 使用更快的API模型
# 在前端选择更快的语音模型

# 2. 减少并发请求
# 控制同时处理的任务数量

# 3. 使用缓存
# 启用前端缓存机制

# 4. 优化网络
# 使用有线网络而非WiFi
# 确保网络带宽充足
```

### 问题：内存占用过高

**解决方案：**

```bash
# 1. 查看内存使用
ps aux | grep python | awk '{print $6}' | awk '{sum+=$1} END {print sum}'

# 2. 清理临时文件
rm -rf temp/*

# 3. 限制并发处理数量
# 在 server.py 中调整并发限制

# 4. 重启服务
pkill -f "python server.py"
python server.py
```

### 问题：磁盘空间不足

**解决方案：**

```bash
# 查看磁盘使用
df -h

# 清理旧的音频文件
find tts_output -name "*.wav" -mtime +7 -delete

# 清理日志文件
find logs -name "*.log" -mtime +7 -delete

# 清理临时文件
rm -rf temp/*

# 压缩历史文件
tar -czf history_backup.tar.gz tts_output/*.wav
```

---

## 权限问题

### 问题：无法写入文件

**错误信息：**
```
PermissionError: [Errno 13] Permission denied
```

**解决方案：**

```bash
# Linux/macOS
# 修改目录权限
chmod 755 tts_output logs temp

# 修改文件权限
chmod 644 tts_output/*.wav

# 修改所有者
sudo chown -R $USER:$USER tts_output logs temp

# Windows
# 以管理员身份运行
# 右键终端 → 以管理员身份运行
```

### 问题：无法读取配置文件

**解决方案：**

```bash
# 检查文件权限
ls -la .env

# 设置正确的权限
chmod 600 .env

# 确保文件存在
ls -la

# 验证文件内容
cat .env
```

---

## 外部访问问题

### 问题：局域网访问失败

**诊断步骤：**

```bash
# 1. 确认服务监听地址
netstat -tlnp | grep 5173
# 应该显示：0.0.0.0:5173
# 如果是 127.0.0.1:5173，需要修改 server.py

# 2. 获取服务器IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# 3. 从另一台设备测试
curl http://服务器IP:5173/health

# 4. 检查网络连通性
ping 服务器IP
```

**server.py 配置检查：**

```python
# 确保使用以下配置
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5173, debug=False)
    # 而不是：app.run(host='127.0.0.1', port=5173)
```

### 问题：防火墙阻止访问

**解决方案：**

```bash
# Ubuntu/Debian - UFW
sudo ufw status
sudo ufw allow 5173/tcp
sudo ufw reload
sudo ufw status verbose

# CentOS/RHEL - firewalld
sudo firewall-cmd --list-all
sudo firewall-cmd --add-port=5173/tcp --permanent
sudo firewall-cmd --reload
sudo firewall-cmd --list-all

# macOS
# 系统偏好设置 → 安全性与隐私 → 防火墙 → 防火墙选项
# 允许Python应用程序接收传入连接

# Windows
# Windows Defender 防火墙 → 高级设置 → 入站规则
# 新建规则 → 端口 → TCP 5173 → 允许连接
```

### 问题：路由器端口转发

**步骤：**

1. **登录路由器管理界面**
   - 通常地址：192.168.1.1 或 192.168.0.1
   - 查看路由器背面的标签

2. **查找端口映射功能**
   - 可能的名称：
     - "虚拟服务器"
     - "端口映射"
     - "端口转发"
     - "NAT设置"

3. **添加映射规则**
   ```
   内部IP：服务器局域网IP（如 192.168.1.100）
   内部端口：5173
   外部端口：5173
   协议：TCP
   ```

4. **保存并重启路由器**

5. **测试外网访问**
   ```bash
   # 从外部网络测试
   curl http://公网IP:5173/health
   ```

### 问题：动态公网IP

**解决方案：使用DDNS服务**

```bash
# 使用 ddclient (Linux)
sudo apt install ddclient

# 配置 ddclient
sudo nano /etc/ddclient.conf
```

配置示例：
```
daemon=300
syslog=yes
mail=root
mail-failure=root
pid=/var/run/ddclient.pid
use=web, web=https://api.ipify.org
protocol=dyndns2
server=your-ddns-provider.com
login=your-username
password=your-password
your-domain.ddns.net
```

```bash
# 启动服务
sudo systemctl enable ddclient
sudo systemctl start ddclient

# 查看状态
sudo systemctl status ddclient
```

---

## 常见错误

### 错误：ModuleNotFoundError

**错误信息：**
```
ModuleNotFoundError: No module named 'xxx'
```

**解决方案：**

```bash
# 重新安装依赖
pip install -r requirements.txt

# 或单独安装缺失的模块
pip install xxx

# 验证安装
python -c "import xxx; print('OK')"
```

### 错误：ImportError

**错误信息：**
```
ImportError: cannot import name 'xxx' from 'yyy'
```

**解决方案：**

```bash
# 更新相关包
pip install --upgrade yyy

# 或卸载重装
pip uninstall yyy
pip install yyy
```

### 错误：JSONDecodeError

**错误信息：**
```
json.decoder.JSONDecodeError: Expecting value
```

**解决方案：**

```bash
# 检查API返回的数据
# 在浏览器开发者工具中查看Network标签

# 查看服务器日志
tail -f logs/server.log

# 验证API密钥和请求格式
```

### 错误：TimeoutError

**错误信息：**
```
TimeoutError: [Errno 110] Connection timed out
```

**解决方案：**

```bash
# 1. 检查网络连接
ping dashscope.aliyuncs.com

# 2. 增加超时时间
# 在 server.py 中修改超时设置

# 3. 检查防火墙和代理设置
env | grep -i proxy

# 4. 尝试使用VPN或更换网络
```

---

## 日志查看

### 查看应用日志

```bash
# 实时查看日志
tail -f logs/server.log

# 查看最近100行
tail -n 100 logs/server.log

# 查看错误日志
grep ERROR logs/server.log

# 查看特定时间的日志
grep "2024-01-01" logs/server.log
```

### 查看系统日志

```bash
# Linux (systemd)
sudo journalctl -u chifanzuiyaojin -f

# 查看最近的错误
sudo journalctl -u chifanzuiyaojin --since today | grep -i error

# 查看最近的警告
sudo journalctl -u chifanzuiyaojin --since today | grep -i warning
```

---

## 健康检查

### 测试服务状态

```bash
# 测试健康检查端点
curl http://localhost:5173/health

# 预期返回：
# {"service":"chifanzuiyaojin","status":"ok"}

# 查看HTTP状态码
curl -I http://localhost:5173/health

# 测试API端点
curl http://localhost:5173/api/get-config
curl http://localhost:5173/api/voices
```

### 创建健康检查脚本

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
    # 可以添加自动重启逻辑
    # pkill -f "python server.py"
    # nohup python server.py > logs/server.log 2>&1 &
    exit 1
fi
```

使用：
```bash
chmod +x health-check.sh
./health-check.sh
```

---

## 常用诊断命令

```bash
# 检查Python版本
python --version

# 检查pip版本
pip --version

# 检查已安装的包
pip list

# 检查服务进程
ps aux | grep python

# 检查端口占用
lsof -i :5173

# 检查网络连接
netstat -tlnp | grep 5173

# 检查磁盘空间
df -h

# 检查内存使用
free -h

# 检查CPU使用
top -bn1 | grep "Cpu(s)"

# 测试API连接
ping dashscope.aliyuncs.com

# 测试DNS解析
nslookup dashscope.aliyuncs.com

# 检查环境变量
env | grep DASHSCOPE
```

---

## 获取帮助

如果以上方案无法解决问题：

1. **收集诊断信息**
   ```bash
   # 生成诊断报告
   cat > diagnostics.txt << EOF
   System Information:
   ===================
   OS: $(uname -a)
   Python: $(python --version)
   Pip: $(pip --version)
   
   Service Status:
   ===============
   Process: $(ps aux | grep "python server.py" | grep -v grep)
   Port: $(lsof -i :5173 2>/dev/null | grep LISTEN)
   
   Network:
   ========
   Local IP: $(ifconfig | grep "inet " | grep -v 127.0.0.1)
   Public IP: $(curl -s ifconfig.me 2>/dev/null)
   
   Recent Errors:
   ==============
   $(tail -n 50 logs/server.log | grep -i error)
   EOF
   ```

2. **查看GitHub Issues**
   - https://github.com/xuduiAlgo/chifanzuiyaojin/issues
   - 搜索相似问题

3. **提交新Issue**
   提供以下信息：
   - 操作系统版本
   - Python版本
   - 完整的错误信息
   - 重现步骤
   - 诊断报告

---

## 快速修复清单

遇到问题时，按顺序检查：

- [ ] Python版本是否正确（3.11+）
- [ ] 依赖是否完整安装
- [ ] 环境变量是否正确配置
- [ ] 服务是否正常运行
- [ ] 端口是否被占用
- [ ] 防火墙是否开放
- [ ] API密钥是否有效
- [ ] 网络连接是否正常
- [ ] 磁盘空间是否充足
- [ ] 文件权限是否正确
- [ ] 日志文件中有无错误信息

---

## 预防性维护

定期执行以下维护任务：

### 每周
```bash
# 清理临时文件
rm -rf temp/*

# 检查磁盘空间
df -h

# 查看错误日志
grep ERROR logs/server.log | tail -20
```

### 每月
```bash
# 清理旧的音频文件（保留7天）
find tts_output -name "*.wav" -mtime +7 -delete

# 清理日志文件（保留30天）
find logs -name "*.log" -mtime +30 -delete

# 更新依赖
pip install --upgrade -r requirements.txt
```

### 每季度
```bash
# 备份重要数据
tar -czf backup_$(date +%Y%m%d).tar.gz tts_output history.json .env

# 检查API使用情况
# 登录阿里云控制台查看调用统计

# 更新系统
sudo apt update && sudo apt upgrade -y  # Linux
```

---

## 联系支持

- **GitHub Issues**: https://github.com/xuduiAlgo/chifanzuiyaojin/issues
- **文档**: https://github.com/xuduiAlgo/chifanzuiyaojin/tree/main/docs
- **API文档**: https://github.com/xuduiAlgo/chifanzuiyaojin/blob/main/docs/API.md
