/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Search, 
  Award, 
  Lightbulb, 
  AlertTriangle, 
  CheckCircle, 
  ArrowRight, 
  Loader2, 
  BookOpen, 
  BarChart3, 
  ShieldCheck,
  Zap,
  FileText,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

// --- Types ---
interface RubricItem {
  criterion: string;
  level: string;
  score: number;
  explanation: string;
}

interface EvaluationResult {
  rubric: RubricItem[];
  totalScore: number;
  classification: string;
  optimization: string[];
  researchVariables: string[];
  dataWarning: string;
  finishingAdvice: string;
}

// --- Constants ---
const SYSTEM_INSTRUCTION = `
Role: Bạn là Chuyên gia tư vấn học thuật cao cấp, chuyên gia trong lĩnh vực Kinh tế số và Kinh doanh số. Nhiệm vụ của bạn là đánh giá tên đề tài khóa luận của sinh viên dựa trên RUBRIC chuẩn.

Bối cảnh chuyên ngành: Đề tài cần thể hiện được sự giao thoa giữa kinh tế/kinh doanh truyền thống với công nghệ số (AI, Blockchain, Big Data, Cloud Computing, IoT).

Quy trình phản hồi (Bắt buộc):
1. Đánh giá theo Rubric Chi Tiết (Tính rõ ràng, Tính học thuật, Tính Logic, Tính mới, Tính khả thi).
2. Tổng điểm (thang 10) và Phân loại (Xuất sắc >8.5, Khá 7.0-8.4, Đạt 5.0-6.9, Chưa đạt <5.0).
3. Tư vấn Chuyên sâu Kinh tế số (Tối ưu hóa tên đề tài, Gợi ý biến số, Cảnh báo dữ liệu).
4. Lời khuyên "Về đích" (Case Study, Hàm ý quản trị).

Tone & Style: Trí tuệ, sắc sảo, cập nhật xu hướng công nghệ mới nhất.

IMPORTANT: Bạn PHẢI trả về kết quả dưới dạng JSON theo cấu trúc sau:
{
  "rubric": [
    { "criterion": "Tên tiêu chí", "level": "Mức độ đạt được", "score": điểm_số, "explanation": "Giải thích chi tiết" }
  ],
  "totalScore": tổng_điểm,
  "classification": "Xếp loại",
  "optimization": ["Phương án 1", "Phương án 2"],
  "researchVariables": ["Biến số 1", "Biến số 2"],
  "dataWarning": "Cảnh báo về dữ liệu",
  "finishingAdvice": "Lời khuyên về đích"
}
`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    rubric: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          criterion: { type: Type.STRING },
          level: { type: Type.STRING },
          score: { type: Type.NUMBER },
          explanation: { type: Type.STRING },
        },
        required: ["criterion", "level", "score", "explanation"],
      },
    },
    totalScore: { type: Type.NUMBER },
    classification: { type: Type.STRING },
    optimization: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    researchVariables: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    dataWarning: { type: Type.STRING },
    finishingAdvice: { type: Type.STRING },
  },
  required: ["rubric", "totalScore", "classification", "optimization", "researchVariables", "dataWarning", "finishingAdvice"],
};

export default function App() {
  const [title, setTitle] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEvaluate = async () => {
    if (!title.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Hãy đánh giá đề tài khóa luận sau: "${title}"`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      if (response.text) {
        const parsedResult = JSON.parse(response.text) as EvaluationResult;
        setResult(parsedResult);
      } else {
        throw new Error("Không nhận được phản hồi từ AI.");
      }
    } catch (err) {
      console.error(err);
      setError("Đã có lỗi xảy ra trong quá trình đánh giá. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!result) return;
    
    // Note: Standard jsPDF fonts don't support Vietnamese characters well.
    // For a production app, we would embed a custom font.
    // Here we use a simple approach, but Word is recommended for full Unicode support.
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('KET QUA DANH GIA DE TAI KHOA LUAN', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Ho va ten: ${studentName || 'N/A'}`, 20, 35);
    doc.text(`Ma so sinh vien: ${studentId || 'N/A'}`, 20, 45);
    doc.text(`De tai: ${title.substring(0, 80)}${title.length > 80 ? '...' : ''}`, 20, 55);
    doc.text(`Tong diem: ${result.totalScore.toFixed(1)}/10.0`, 20, 65);
    doc.text(`Xep loai: ${result.classification}`, 20, 75);
    
    const tableData = result.rubric.map(item => [
      item.criterion,
      item.level,
      item.score.toString(),
      item.explanation
    ]);
    
    autoTable(doc, {
      startY: 85,
      head: [['Tieu chi', 'Muc do', 'Diem', 'Giai thich']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
    });
    
    const fileName = (studentName.trim() || 'Danh_gia_khoa_luan').replace(/\s+/g, '_');
    doc.save(`${fileName}.pdf`);
  };

  const exportToWord = async () => {
    if (!result) return;

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "KẾT QUẢ ĐÁNH GIÁ ĐỀ TÀI KHÓA LUẬN",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Họ và tên: ", bold: true }),
              new TextRun(studentName || "N/A"),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Mã số sinh viên: ", bold: true }),
              new TextRun(studentId || "N/A"),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Đề tài: ", bold: true }),
              new TextRun(title),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Tổng điểm: ", bold: true }),
              new TextRun(`${result.totalScore.toFixed(1)}/10.0`),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Xếp loại: ", bold: true }),
              new TextRun(result.classification),
            ],
            spacing: { after: 400 },
          }),
          new Paragraph({
            text: "ĐÁNH GIÁ CHI TIẾT",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Tiêu chí", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Mức độ", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Điểm", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Giải thích", bold: true })] })] }),
                ],
              }),
              ...result.rubric.map(item => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(item.criterion)] }),
                  new TableCell({ children: [new Paragraph(item.level)] }),
                  new TableCell({ children: [new Paragraph(item.score.toString())] }),
                  new TableCell({ children: [new Paragraph(item.explanation)] }),
                ],
              })),
            ],
          }),
          new Paragraph({
            text: "TƯ VẤN CHUYÊN SÂU",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Tối ưu hóa tên đề tài:", bold: true })],
            spacing: { after: 100 },
          }),
          ...result.optimization.map(opt => new Paragraph({
            text: `• ${opt}`,
            indent: { left: 400 },
            spacing: { after: 100 },
          })),
          new Paragraph({
            children: [new TextRun({ text: "Biến số nghiên cứu gợi ý: ", bold: true }), new TextRun(result.researchVariables.join(", "))],
            spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Cảnh báo về dữ liệu: ", bold: true }), new TextRun(result.dataWarning)],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Lời khuyên về đích: ", bold: true }), new TextRun(result.finishingAdvice)],
            spacing: { after: 200 },
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const fileName = (studentName.trim() || 'Danh_gia_khoa_luan').replace(/\s+/g, '_');
    saveAs(blob, `${fileName}.docx`);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="bg-white border-b border-black/5 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
              <Zap size={18} />
            </div>
            <h1 className="font-semibold text-lg tracking-tight">Digital Thesis Consultant</h1>
          </div>
          <div className="text-xs font-mono text-gray-400 uppercase tracking-widest">
            v1.0.0 / Academic AI
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <section className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-bold uppercase tracking-widest mb-6"
          >
            <Zap size={12} />
            AI-Powered Academic Advisor
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1]"
          >
            Nâng Tầm Đề Tài <br />
            <span className="text-emerald-600">Kinh Tế Số</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-500 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed"
          >
            Hệ thống đánh giá chuyên sâu dựa trên Rubric chuẩn quốc tế, giúp sinh viên tối ưu hóa thuật ngữ và định hướng nghiên cứu trong kỷ nguyên số.
          </motion.p>
        </section>

        {/* Input Area */}
        <section className="mb-8">
          <div className="bg-white rounded-3xl shadow-xl shadow-black/5 border border-black/5 p-8 md:p-10 max-w-3xl mx-auto relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-50" />
            
            <div className="flex flex-col gap-6 relative z-10">
              <div className="flex items-center justify-between">
                <label htmlFor="thesis-title" className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Đề tài nghiên cứu
                </label>
                <div className="text-[10px] font-mono text-gray-300">MAX 500 CHARS</div>
              </div>
              
              <div className="relative">
                <textarea
                  id="thesis-title"
                  rows={3}
                  className="w-full bg-gray-50/50 border border-gray-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all resize-none text-lg md:text-xl font-medium placeholder:text-gray-300"
                  placeholder="Nhập tên đề tài khóa luận của bạn tại đây..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="student-name" className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Họ và tên
                  </label>
                  <input
                    id="student-name"
                    type="text"
                    className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-base font-medium placeholder:text-gray-300"
                    placeholder="Nguyễn Văn A"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="student-id" className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Mã số sinh viên
                  </label>
                  <input
                    id="student-id"
                    type="text"
                    className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-base font-medium placeholder:text-gray-300"
                    placeholder="SV123456"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <button
                  onClick={handleEvaluate}
                  disabled={loading || !title.trim()}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 group shadow-xl shadow-emerald-600/20 active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Đang thẩm định...
                    </>
                  ) : (
                    <>
                      Phân tích đề tài
                      <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Sample Titles */}
        {!result && !loading && (
          <motion.section 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-16 max-w-3xl mx-auto"
          >
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Gợi ý thử nghiệm</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                "Kinh doanh online trên Facebook",
                "Tác động của Big Data đến chuỗi cung ứng",
                "Phát triển Fintech tại Việt Nam",
                "Giải pháp chuyển đổi số cho doanh nghiệp bán lẻ"
              ].map((sample, i) => (
                <button
                  key={i}
                  onClick={() => setTitle(sample)}
                  className="text-left p-3 rounded-xl border border-dashed border-gray-300 text-gray-500 text-sm hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition-all"
                >
                  {sample}
                </button>
              ))}
            </div>
          </motion.section>
        )}

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl mb-8 flex items-center gap-3 max-w-3xl mx-auto"
            >
              <AlertTriangle size={20} />
              <p className="text-sm font-medium">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Section */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Score Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm flex flex-col items-center justify-center text-center">
                  <span className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-2">Tổng Điểm</span>
                  <div className="text-6xl font-bold text-emerald-600 mb-2">{result.totalScore.toFixed(1)}</div>
                  <div className="text-sm font-mono text-gray-400">/ 10.0</div>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm flex flex-col items-center justify-center text-center md:col-span-2 relative overflow-hidden">
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button 
                      onClick={exportToWord}
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                      title="Xuất Word (.docx)"
                    >
                      <FileText size={16} />
                      Word
                    </button>
                    <button 
                      onClick={exportToPDF}
                      className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                      title="Xuất PDF (.pdf)"
                    >
                      <Download size={16} />
                      PDF
                    </button>
                  </div>
                  <span className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-2">Phân Loại Học Thuật</span>
                  <div className="text-4xl font-bold mb-4">{result.classification}</div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div 
                        key={i} 
                        className={`w-12 h-2 rounded-full ${i <= (result.totalScore / 2) ? 'bg-emerald-500' : 'bg-gray-100'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Rubric Table */}
              <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-black/5 flex items-center gap-2">
                  <BarChart3 size={20} className="text-emerald-600" />
                  <h3 className="font-bold text-lg">Đánh Giá Theo Rubric Chi Tiết</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-black/5">Tiêu chí</th>
                        <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-black/5">Mức độ</th>
                        <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-black/5">Điểm</th>
                        <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-black/5">Giải thích</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {result.rubric.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-4 font-medium text-sm">{item.criterion}</td>
                          <td className="p-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                              {item.level}
                            </span>
                          </td>
                          <td className="p-4 font-mono font-bold text-emerald-600">{item.score}</td>
                          <td className="p-4 text-sm text-gray-500 leading-relaxed">{item.explanation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Consulting Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Optimization */}
                <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <Lightbulb size={20} className="text-amber-500" />
                    <h3 className="font-bold text-lg">Tối Ưu Hóa Tên Đề Tài</h3>
                  </div>
                  <div className="space-y-4">
                    {result.optimization.map((opt, i) => (
                      <div key={i} className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl relative group">
                        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-amber-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                        <p className="text-sm font-medium text-amber-900 italic">"{opt}"</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Variables */}
                <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <BookOpen size={20} className="text-blue-500" />
                    <h3 className="font-bold text-lg">Biến Số Nghiên Cứu Gợi Ý</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.researchVariables.map((v, i) => (
                      <span key={i} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold border border-blue-100">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Warnings & Advice */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck size={20} className="text-red-500" />
                    <h3 className="font-bold text-lg">Cảnh Báo Về Dữ Liệu</h3>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {result.dataWarning}
                  </p>
                </div>
                <div className="bg-emerald-900 p-8 rounded-2xl shadow-xl text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Award size={120} />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle size={20} className="text-emerald-400" />
                      <h3 className="font-bold text-lg">Lời Khuyên "Về Đích"</h3>
                    </div>
                    <p className="text-emerald-50/80 text-sm leading-relaxed">
                      {result.finishingAdvice}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer Action */}
              <div className="text-center py-12">
                <button 
                  onClick={() => {
                    setResult(null);
                    setTitle('');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-sm font-medium text-gray-400 hover:text-emerald-600 transition-colors"
                >
                  Thực hiện đánh giá đề tài mới
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-top border-black/5 py-12 bg-white">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-xs text-gray-400 font-mono uppercase tracking-widest mb-4">
            Powered by Gemini 3 Flash & Digital Economics Academic Framework
          </p>
          <div className="flex justify-center gap-6 text-gray-300">
            <Zap size={16} />
            <ShieldCheck size={16} />
            <Award size={16} />
          </div>
        </div>
      </footer>
    </div>
  );
}
