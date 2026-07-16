<<<<<<< HEAD
# yueyue-teacher-exam
=======
# 月月上岸计划

一个面向教师资格证考试的离线优先闯关复习网站，当前覆盖 1276 道题：

- 中学《教育知识与能力》八章学习地图。
- 初中地理学科知识、课标与教学设计学习地图。
- 2014—2025 年 22 套科目二真题：462 道选择题、220 道主观题。
- 《初中地理》三色速记手册拆分出的 576 个主动回忆关卡。
- 选择题自动判分。
- 辨析题、简答题、材料题本地关键词与结构估分。
- 年份、科目、题型、难度和关键词筛选。
- 自动错题本、星星奖励、复习进度。
- 600+ 真题闪卡、全科思维导图。
- 浏览器本地保存、JSON 进度备份。

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
pnpm install
pnpm run dev
```

然后打开终端显示的本地网址。

## 数据说明

题目来自用户提供的重点笔记、地理速记手册和十年真题扫描件。选择题答案已与公开解析交叉核对；主观题显示的是依据复习资料整理的“参考评分框架”，不等同于官方阅卷结论。

学习进度仅保存在当前浏览器，不会上传。可在页面底部导出 JSON 备份。

## 部署到 GitHub Pages

项目已经附带自动部署工作流。你只需要：

1. 在 GitHub 新建一个空仓库，例如 `yueyue-teacher-exam`。
2. 在本项目目录运行：

```bash
git add .
git commit -m "完成月月教资闯关题库"
git branch -M main
git remote add origin https://github.com/你的用户名/yueyue-teacher-exam.git
git push -u origin main
```

3. 打开 GitHub 仓库的 `Settings → Pages`，在 `Build and deployment` 中选择 `GitHub Actions`。
4. 等待仓库的 `Actions` 页面出现绿色对勾。网址通常是：

```text
https://你的用户名.github.io/yueyue-teacher-exam/
```

以后每次推送到 `main` 分支，网站都会自动更新。
>>>>>>> b7e1d91 (完成月月教资复习网站)
