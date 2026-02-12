#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/deploy.config.json"
LOG_FILE="$SCRIPT_DIR/deploy.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

check_dependencies() {
    log_info "检查依赖工具..."

    local missing_deps=()

    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi

    if ! command -v ssh &> /dev/null; then
        missing_deps+=("ssh")
    fi

    if ! command -v scp &> /dev/null; then
        missing_deps+=("scp")
    fi

    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "缺少依赖工具: ${missing_deps[*]}"
        log_info "请安装缺少的工具后重试"
        exit 1
    fi

    log_success "所有依赖工具已安装"
}

check_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        log_warning "配置文件不存在，启动配置向导..."
        bash "$SCRIPT_DIR/setup-deploy.sh"
        if [ $? -ne 0 ]; then
            log_error "配置向导执行失败"
            exit 1
        fi
    fi

    if [ ! -f "$CONFIG_FILE" ]; then
        log_error "配置文件创建失败"
        exit 1
    fi

    log_success "配置文件已就绪"
}

load_config() {
    log_info "加载配置..."

    SERVER_HOST=$(jq -r '.server.host' "$CONFIG_FILE")
    SERVER_USER=$(jq -r '.server.user' "$CONFIG_FILE")
    DOMAIN=$(jq -r '.server.domain' "$CONFIG_FILE")
    DEPLOY_DIR=$(jq -r '.server.deployDir' "$CONFIG_FILE")
    SSL_USE_LETSENCRYPT=$(jq -r '.ssl.useLetsEncrypt' "$CONFIG_FILE")
    SSL_AUTO_RENEW=$(jq -r '.ssl.autoRenew' "$CONFIG_FILE")

    if [ -z "$SERVER_HOST" ] || [ "$SERVER_HOST" = "null" ]; then
        log_error "服务器地址未配置"
        exit 1
    fi

    if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "null" ]; then
        log_error "域名未配置"
        exit 1
    fi

    if [ -z "$DEPLOY_DIR" ] || [ "$DEPLOY_DIR" = "null" ]; then
        DEPLOY_DIR="/opt/offline-html"
        log_warning "部署目录未配置，使用默认值: $DEPLOY_DIR"
    fi

    log_success "配置加载成功"
    log_info "服务器: $SERVER_USER@$SERVER_HOST"
    log_info "域名: $DOMAIN"
    log_info "部署目录: $DEPLOY_DIR"
    log_info "SSL: Let's Encrypt=$SSL_USE_LETSENCRYPT, 自动续期=$SSL_AUTO_RENEW"
}

test_ssh_connection() {
    log_info "测试SSH连接..."

    if ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o BatchMode=yes "$SERVER_USER@$SERVER_HOST" "echo 'SSH连接成功'" &> /dev/null; then
        log_success "SSH连接测试成功"
        return 0
    else
        log_error "SSH连接测试失败"
        log_info "请检查："
        log_info "1. SSH密钥是否正确配置"
        log_info "2. 服务器地址是否正确"
        log_info "3. 服务器是否允许SSH连接"
        return 1
    fi
}

run_deployment() {
    print_header "开始部署"

    log_info "执行部署脚本..."
    bash "$SCRIPT_DIR/deploy.sh"

    if [ $? -eq 0 ]; then
        log_success "部署完成"
    else
        log_error "部署失败"
        exit 1
    fi
}

setup_ssl() {
    print_header "配置SSL证书"

    log_info "执行SSL配置脚本..."
    bash "$SCRIPT_DIR/setup-ssl.sh"

    if [ $? -eq 0 ]; then
        log_success "SSL配置完成"
    else
        log_warning "SSL配置失败，但部署仍可继续使用HTTP"
    fi
}

run_health_check() {
    print_header "健康检查"

    log_info "执行健康检查脚本..."
    bash "$SCRIPT_DIR/health-check.sh"

    if [ $? -eq 0 ]; then
        log_success "健康检查通过"
    else
        log_warning "健康检查发现问题，请检查日志"
    fi
}

print_summary() {
    print_header "部署摘要"

    echo -e "${GREEN}✓ 部署完成！${NC}"
    echo ""
    echo "访问信息："
    echo "  HTTP:  http://$DOMAIN"
    echo "  HTTPS: https://$DOMAIN"
    echo ""
    echo "服务器信息："
    echo "  地址: $SERVER_HOST"
    echo "  用户: $SERVER_USER"
    echo "  目录: $DEPLOY_DIR"
    echo ""
    echo "管理命令："
    echo "  查看日志: ssh $SERVER_USER@$SERVER_HOST 'cd $DEPLOY_DIR && docker-compose logs -f'"
    echo "  重启服务: ssh $SERVER_USER@$SERVER_HOST 'cd $DEPLOY_DIR && docker-compose restart'"
    echo "  停止服务: ssh $SERVER_USER@$SERVER_HOST 'cd $DEPLOY_DIR && docker-compose stop'"
    echo "  健康检查: bash $SCRIPT_DIR/health-check.sh"
    echo ""
    echo "日志文件: $LOG_FILE"
    echo ""
}

main() {
    echo ""
    echo -e "${GREEN}"
    echo "  ╔════════════════════════════════════════╗"
    echo "  ║     一键部署脚本 v1.0                  ║"
    echo "  ║     Docker + Nginx + HTTPS             ║"
    echo "  ╚════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""

    check_dependencies
    check_config
    load_config
    test_ssh_connection
    run_deployment
    setup_ssl
    run_health_check
    print_summary

    log_success "一键部署流程完成！"
}

main "$@"
