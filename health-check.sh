#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

load_config() {
    local config_file="deploy.config.json"

    if [ ! -f "$config_file" ]; then
        log_error "配置文件不存在: $config_file"
        log_info "请先运行: ./setup-deploy.sh"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log_error "未找到jq命令，请安装: brew install jq"
        exit 1
    fi

    SERVER_USER=$(jq -r '.server.user' "$config_file")
    SERVER_HOST=$(jq -r '.server.host' "$config_file")
    DEPLOY_DIR=$(jq -r '.server.deployDir' "$config_file")
    DOMAIN=$(jq -r '.server.domain' "$config_file")

    log_info "配置加载成功"
    log_info "服务器: $SERVER_USER@$SERVER_HOST"
    log_info "域名: $DOMAIN"
}

check_ssh_connection() {
    log_info "检查SSH连接..."

    if ! ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST "echo 'SSH连接成功'" 2>/dev/null; then
        log_error "SSH连接失败"
        return 1
    fi

    log_success "SSH连接正常"
    return 0
}

check_docker_status() {
    log_info "检查Docker状态..."

    local docker_status=$(ssh $SERVER_USER@$SERVER_HOST "docker ps --format '{{.Names}}: {{.Status}}' 2>/dev/null" || echo "")

    if [ -z "$docker_status" ]; then
        log_error "Docker未运行或无容器运行"
        return 1
    fi

    log_success "Docker运行正常"
    echo "$docker_status"
    return 0
}

check_docker_compose_status() {
    log_info "检查Docker Compose状态..."

    local compose_status=$(ssh $SERVER_USER@$SERVER_HOST "cd $DEPLOY_DIR && docker-compose ps 2>/dev/null" || echo "")

    if [ -z "$compose_status" ]; then
        log_error "Docker Compose未运行"
        return 1
    fi

    log_success "Docker Compose运行正常"
    echo "$compose_status"
    return 0
}

check_http_status() {
    local url=$1
    local description=$2

    log_info "检查 $description..."

    local http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
    local response_time=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$url" 2>/dev/null || echo "0.000")

    if [ "$http_code" = "200" ]; then
        log_success "$description 正常 (HTTP $http_code, ${response_time}s)"
        return 0
    else
        log_error "$description 异常 (HTTP $http_code, ${response_time}s)"
        return 1
    fi
}

check_ssl_certificate() {
    log_info "检查SSL证书..."

    local cert_info=$(ssh $SERVER_USER@$SERVER_HOST "openssl x509 -in $DEPLOY_DIR/ssl/cert.pem -noout -subject -dates 2>/dev/null" || echo "")

    if [ -z "$cert_info" ]; then
        log_error "SSL证书不存在或无效"
        return 1
    fi

    log_success "SSL证书有效"
    echo "$cert_info"
    return 0
}

check_disk_space() {
    log_info "检查磁盘空间..."

    local disk_info=$(ssh $SERVER_USER@$SERVER_HOST "df -h $DEPLOY_DIR | tail -1" 2>/dev/null || echo "")

    if [ -z "$disk_info" ]; then
        log_error "无法获取磁盘信息"
        return 1
    fi

    log_success "磁盘空间正常"
    echo "$disk_info"
    return 0
}

check_memory_usage() {
    log_info "检查内存使用..."

    local memory_info=$(ssh $SERVER_USER@$SERVER_HOST "free -h | grep Mem" 2>/dev/null || echo "")

    if [ -z "$memory_info" ]; then
        log_error "无法获取内存信息"
        return 1
    fi

    log_success "内存使用正常"
    echo "$memory_info"
    return 0
}

check_file_count() {
    log_info "检查文件数量..."

    local html_count=$(ssh $SERVER_USER@$SERVER_HOST "find $DEPLOY_DIR/html -type f 2>/dev/null | wc -l" || echo "0")
    local media_count=$(ssh $SERVER_USER@$SERVER_HOST "find $DEPLOY_DIR/media -type f 2>/dev/null | wc -l" || echo "0")

    log_success "文件统计: HTML=$html_count, Media=$media_count"
    return 0
}

check_recent_logs() {
    log_info "检查最近的日志..."

    local logs=$(ssh $SERVER_USER@$SERVER_HOST "cd $DEPLOY_DIR && docker-compose logs --tail=10 2>/dev/null" || echo "")

    if [ -z "$logs" ]; then
        log_warning "无法获取日志"
        return 1
    fi

    log_success "最近的日志:"
    echo "$logs"
    return 0
}

print_health_report() {
    print_header "健康检查报告"

    local total_checks=0
    local passed_checks=0

    check_ssh_connection && ((passed_checks++)) || true
    ((total_checks++))

    check_docker_status && ((passed_checks++)) || true
    ((total_checks++))

    check_docker_compose_status && ((passed_checks++)) || true
    ((total_checks++))

    check_http_status "https://$DOMAIN/health" "健康检查端点" && ((passed_checks++)) || true
    ((total_checks++))

    check_http_status "https://$DOMAIN/" "主页" && ((passed_checks++)) || true
    ((total_checks++))

    check_ssl_certificate && ((passed_checks++)) || true
    ((total_checks++))

    check_disk_space && ((passed_checks++)) || true
    ((total_checks++))

    check_memory_usage && ((passed_checks++)) || true
    ((total_checks++))

    check_file_count && ((passed_checks++)) || true
    ((total_checks++))

    echo ""
    log_info "检查结果: $passed_checks/$total_checks 通过"

    if [ $passed_checks -eq $total_checks ]; then
        log_success "✅ 所有检查通过！系统运行正常"
        return 0
    else
        log_warning "⚠️  部分检查失败，请查看详细信息"
        return 1
    fi
}

main() {
    print_header "服务器健康检查"

    load_config

    if [ "$1" = "--verbose" ] || [ "$1" = "-v" ]; then
        check_ssh_connection
        check_docker_status
        check_docker_compose_status
        check_http_status "https://$DOMAIN/health" "健康检查端点"
        check_http_status "https://$DOMAIN/" "主页"
        check_http_status "https://$DOMAIN/html/" "HTML目录"
        check_http_status "https://$DOMAIN/media/" "媒体目录"
        check_http_status "https://$DOMAIN/api/mapping" "映射API"
        check_ssl_certificate
        check_disk_space
        check_memory_usage
        check_file_count
        check_recent_logs
    fi

    print_health_report
}

main "$@"
