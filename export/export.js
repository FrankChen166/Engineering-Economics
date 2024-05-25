const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../models/user"); // 確保你的 User 模型路徑正確
const excel = require("exceljs");

// 處理導出學生信息的路由
router.get("/class/:className/export", async (req, res) => {
  try {
    const { className } = req.params;

    // 查詢指定班級的所有學生信息
    const students = await User.find({ role: "student", CLASS: className });

    // 創建一個新的工作簿
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet("Students");

    // 添加表頭
    worksheet.columns = [
      { header: "班級", key: "CLASS", width: 10 },
      { header: "姓名", key: "username", width: 15 },
      { header: "學生 ID", key: "studentId", width: 15 },
      { header: "第一次分數", key: "firstScore", width: 15 },
      { header: "第二次分數", key: "secondScore", width: 15 },
    ];

    // 添加學生數據
    students.forEach((student) => {
      worksheet.addRow({
        CLASS: student.CLASS,
        username: student.username,
        studentId: student.studentId,
        firstScore: student.firstScore !== undefined ? student.firstScore : 0,
        secondScore:
          student.secondScore !== undefined ? student.secondScore : 0,
      });
    });

    // 設置響應頭，並發送 Excel 文件
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=students.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting student info:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
