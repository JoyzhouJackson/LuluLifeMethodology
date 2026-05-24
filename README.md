# 人生管理系统

一个只在本机运行的私人 Web App，用来记录随心记、成功日记、感恩日记、错事错话、戒坏习惯替代、方法论流程图、存钱罐奖励和木鱼肯定语。

## 启动

```powershell
node src/server.js
```

然后打开：

```text
http://localhost:5177
```

数据会保存在 `data/life-system.json`，上传照片会保存在 `data/uploads/`。这些文件已被 `.gitignore` 忽略，默认不提交到 Git。

## 测试

```powershell
node --test tests\core.test.js tests\store.test.js
```
