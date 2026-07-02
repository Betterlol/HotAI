1. Docker Desktop -> Setting -> Docker Engine -> Add the following to the JSON configuration file:

```json
// {
//   "registry-mirrors": [
//     "https://docker.1ms.run",
//     "https://dockerpull.com",
//     "https://dockerproxy.com"
//   ]
// }

{
  "builder": {
    "gc": {
      "defaultKeepStorage": "20GB",
      "enabled": true
    }
  },
  "dns": [
    "223.5.5.5",
    "119.29.29.29",
    "8.8.8.8"
  ],
  "features": {
    "buildkit": true
  },
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://dockerproxy.com"
  ]
}
```

2. configure the Go proxy and checksum database to use the Chinese mirrors: 

```bash
go env -w GOPROXY=https://goproxy.cn,direct
# go env -w GOPROXY=https://goproxy.qiniu.com,direct
go env -w GOSUMDB=sum.golang.google.cn
```

3. build the new-api service with the following command:

```bash
docker compose -f docker-compose.dev.yml up -d --build new-api
```

4. push the new-api image to the Docker registry with the following command:

```bash
docker compose -f docker-compose.build.yml build
# Dockerfile 中写死了 go env，不会读取宿主机的 go env 配置，所以需要在 build 时传入参数
# grep -n "GOPROXY\|go mod download" Dockerfile 可查看：
# 具体来说：ENV GO111MODULE=on CGO_ENABLED=0 GOPROXY=https://goproxy.cn,direct

docker compose -f docker-compose.build.yml push
```

5. 

```bash
docker compose pull
docker compose up -d
```

6. 

```bash
docker exec new-api-postgres pg_dump -U postgres new-api > new-api.sql
docker exec -i new-api-postgres psql -U postgres new-api < new-api.sql
```


