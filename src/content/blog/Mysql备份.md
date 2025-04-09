---
date: 2025-04-09T14:48:00
title: Mysql数据库备份与迁移
keywords: ["MYSQL"]
featured: true
summary: "Mysql数据库备份与恢复总结"
---

# 备份方式

| 备份方式 | 关键点         | 缺点                     |
|-|-|-|
| 物理备份 | 直接拷贝源文件 | 原始文件比逻辑文件大的多<br />兼容性差(跨平台、操作系统、msql版本) |
| 逻辑备份 | 可以使用编辑器或者`grep`、`sed`等命令操作<br />使用**PerconaXtraBackup**(TB)、**mysqldump**(<百G)等基于快照的工具备份 | 还原很慢 |

# 备份操作流程

## PerconaXtraBackup

**步骤 1：安装XtraBackup**

```bash
# Ubuntu/Debian
sudo apt-get install percona-xtrabackup-80

# CentOS/RHEL
sudo yum install percona-xtrabackup-80
```

**步骤 2：全量备份**

```bash
# 执行全量备份（备份到目录/backups/full）
xtrabackup --backup --user=root --password=your_password --target-dir=/backups/full
```

**步骤 3：传输备份到测试环境**

```bash
# 压缩并传输
tar -czvf full_backup.tar.gz /backups/full
scp full_backup.tar.gz test-server:/backups/
```

**步骤 4：在测试环境恢复数据**

```bash
# 解压并准备备份
tar -xzvf full_backup.tar.gz
xtrabackup --prepare --target-dir=/backups/full

# 停止MySQL，清空数据目录，恢复文件
systemctl stop mysql
rm -rf /var/lib/mysql/*
xtrabackup --copy-back --target-dir=/backups/full
chown -R mysql:mysql /var/lib/mysql
systemctl start mysql
```

## mysqldump

**步骤 1：导出数据**

```bash
# 导出所有数据库（无锁表，InnoDB使用--single-transaction）
mysqldump --single-transaction -u root -p your_password --all-databases > full_backup.sql

# 仅导出部分表（示例：db1.table1）
mysqldump -u root -p db1 table1 > table1.sql
```



**步骤 2：传输并导入测试环境**

```bas
# 压缩传输
gzip full_backup.sql
scp full_backup.sql.gz test-server:/backups/

# 在测试环境解压并导入
gunzip full_backup.sql.gz
mysql -u root -p < full_backup.sql
```

# 自动化脚本

## 使用步骤

1. 赋予脚本执行权限：

```bash
chmod +x mysql_backup.sh   # Shell版本
chmod +x mysql_backup.py   # Python版本
```

2. 创建MySQL备份专用账号（需授予权限）：

```sql
CREATE USER 'backup_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT RELOAD, PROCESS, LOCK TABLES, REPLICATION CLIENT ON *.* TO 'backup_user'@'localhost';
FLUSH PRIVILEGES;
```

3. 运行脚本

```bas
./mysql_backup.sh full     # 执行全量备份
./mysql_backup.sh          # 执行增量备份
```

## mysql_backup.sh

```bash
#!/bin/bash

# 配置参数
BACKUP_DIR="/backups/mysql"          # 备份存储目录
MYSQL_USER="backup_user"             # MySQL备份专用账号
MYSQL_PASSWORD="your_password"       # 密码
LOG_FILE="/var/log/mysql_backup.log" # 日志文件路径
RETENTION_DAYS=7                     # 备份保留天数

# 创建备份目录（如果不存在）
mkdir -p $BACKUP_DIR

# 定义当前备份目录（按日期命名）
CURRENT_DATE=$(date +%Y%m%d_%H%M%S)
FULL_BACKUP_DIR="$BACKUP_DIR/full_$CURRENT_DATE"
INC_BACKUP_DIR="$BACKUP_DIR/inc_$CURRENT_DATE"

# 日志记录函数
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

# 错误处理函数
error_exit() {
    log "ERROR: $1"
    # 发送告警邮件（需配置邮件服务，可选）
    # echo "MySQL备份失败: $1" | mail -s "Backup Failed" admin@example.com
    exit 1
}

# 执行全量备份
perform_full_backup() {
    log "Starting full backup to $FULL_BACKUP_DIR..."
    xtrabackup --backup --user=$MYSQL_USER --password=$MYSQL_PASSWORD --target-dir=$FULL_BACKUP_DIR 2>>$LOG_FILE
    if [ $? -ne 0 ]; then
        error_exit "Full backup failed!"
    fi
    log "Full backup completed. Compressing..."
    tar -czvf $FULL_BACKUP_DIR.tar.gz $FULL_BACKUP_DIR && rm -rf $FULL_BACKUP_DIR
}

# 执行增量备份（基于上一次全量或增量）
perform_incremental_backup() {
    LATEST_FULL=$(ls -d $BACKUP_DIR/full_* 2>/dev/null | sort -r | head -1)
    if [ -z "$LATEST_FULL" ]; then
        log "No full backup found. Starting initial full backup..."
        perform_full_backup
    else
        log "Starting incremental backup based on $LATEST_FULL..."
        xtrabackup --backup --user=$MYSQL_USER --password=$MYSQL_PASSWORD \
          --target-dir=$INC_BACKUP_DIR --incremental-basedir=$LATEST_FULL 2>>$LOG_FILE
        if [ $? -ne 0 ]; then
            error_exit "Incremental backup failed!"
        fi
        log "Incremental backup completed. Compressing..."
        tar -czvf $INC_BACKUP_DIR.tar.gz $INC_BACKUP_DIR && rm -rf $INC_BACKUP_DIR
    fi
}

# 清理旧备份
clean_old_backups() {
    log "Cleaning backups older than $RETENTION_DAYS days..."
    find $BACKUP_DIR -name "full_*.tar.gz" -mtime +$RETENTION_DAYS -exec rm -f {} \;
    find $BACKUP_DIR -name "inc_*.tar.gz" -mtime +$RETENTION_DAYS -exec rm -f {} \;
}

# 主逻辑
if [ "$1" = "full" ]; then
    perform_full_backup
else
    perform_incremental_backup
fi

clean_old_backups
log "Backup process finished successfully."
```

## 定时任务

```bash
# 每天凌晨2点执行全量备份，每小时执行增量备份
0 2 * * * /bin/bash /path/to/mysql_backup.sh full >> /var/log/mysql_backup.log 2>&1
0 * * * * /bin/bash /path/to/mysql_backup.sh >> /var/log/mysql_backup.log 2>&1
```



## mysql_backup.py 

```python
#!/usr/bin/env python3
import os
import subprocess
import shutil
from datetime import datetime, timedelta

# 配置参数
BACKUP_DIR = "/backups/mysql"
MYSQL_USER = "backup_user"
MYSQL_PASSWORD = "your_password"
LOG_FILE = "/var/log/mysql_backup.log"
RETENTION_DAYS = 7

def log(message):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with open(LOG_FILE, 'a') as f:
        f.write(f"[{timestamp}] {message}\n")

def error_exit(message):
    log(f"ERROR: {message}")
    # 发送告警通知（需集成邮件/API）
    exit(1)

def perform_backup(backup_type='inc'):
    try:
        current_date = datetime.now().strftime("%Y%m%d_%H%M%S")
        if backup_type == 'full':
            target_dir = os.path.join(BACKUP_DIR, f"full_{current_date}")
            log(f"Starting full backup to {target_dir}...")
            cmd = [
                'xtrabackup',
                '--backup',
                f'--user={MYSQL_USER}',
                f'--password={MYSQL_PASSWORD}',
                f'--target-dir={target_dir}'
            ]
        else:
            # 查找最新的全量备份
            full_backups = sorted([d for d in os.listdir(BACKUP_DIR) if d.startswith('full_')])
            if not full_backups:
                log("No full backup found. Performing initial full backup...")
                perform_backup(backup_type='full')
                return
            latest_full = os.path.join(BACKUP_DIR, full_backups[-1])
            target_dir = os.path.join(BACKUP_DIR, f"inc_{current_date}")
            log(f"Starting incremental backup based on {latest_full}...")
            cmd = [
                'xtrabackup',
                '--backup',
                f'--user={MYSQL_USER}',
                f'--password={MYSQL_PASSWORD}',
                f'--target-dir={target_dir}',
                f'--incremental-basedir={latest_full}'
            ]

        # 执行备份命令
        result = subprocess.run(cmd, stderr=subprocess.PIPE, text=True)
        if result.returncode != 0:
            error_exit(f"Backup failed: {result.stderr}")

        # 压缩并删除原目录
        log("Compressing backup...")
        shutil.make_archive(target_dir, 'gztar', target_dir)
        shutil.rmtree(target_dir)

    except Exception as e:
        error_exit(str(e))

def clean_old_backups():
    now = datetime.now()
    for item in os.listdir(BACKUP_DIR):
        item_path = os.path.join(BACKUP_DIR, item)
        if os.path.isfile(item_path) and item.endswith('.tar.gz'):
            file_time = datetime.fromtimestamp(os.path.getmtime(item_path))
            if (now - file_time) > timedelta(days=RETENTION_DAYS):
                log(f"Deleting old backup: {item}")
                os.remove(item_path)

if __name__ == "__main__":
    import sys
    backup_type = sys.argv[1] if len(sys.argv) > 1 else 'inc'
    perform_backup(backup_type)
    clean_old_backups()
    log("Backup process completed.")
```

