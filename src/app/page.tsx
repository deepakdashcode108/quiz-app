// app/create-quiz/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, PlusCircle } from "lucide-react";
import katex from "katex";

// ✅ Import & register Quill formats (v3 requires this)
import { Quill } from "react-quill-new";
import Bold from "quill/formats/bold";
import Italic from "quill/formats/italic";
import Underline from "quill/formats/underline";
import Strike from "quill/formats/strike";
import List from "quill/formats/list";
import Image from "quill/formats/image";

Quill.register(Bold, true);
Quill.register(Italic, true);
Quill.register(Underline, true);
Quill.register(Strike, true);
Quill.register(List, true);
Quill.register(Image, true);

// ---------- Types ----------
interface Option {
  text: string;
}
interface Question {
  id: number;
  question: string;
  options: Option[];
  correctAnswer: number;
}

// ---------- Dynamic Quill ----------
const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => (
    <div className="p-4 text-center border rounded-md bg-gray-50 h-32 flex items-center justify-center">
      Loading Editor...
    </div>
  ),
});
const QuillEditor: React.FC<any> = (props) => <ReactQuill {...props} />;

// ---------- RichText + KaTeX Renderer ----------
const RichTextViewer: React.FC<{ htmlContent: string }> = ({ htmlContent }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      const formulas = contentRef.current.querySelectorAll(".ql-formula");
      formulas.forEach((el) => {
        const formula = el.getAttribute("data-value");
        if (formula) {
          try {
            katex.render(formula, el as HTMLElement, {
              throwOnError: false,
              displayMode: el.tagName === "DIV",
            });
          } catch (e) {
            console.error("KaTeX error:", e);
            el.textContent = `[Error rendering formula: ${formula}]`;
          }
        }
      });
    }
  }, [htmlContent]);

  return (
    <div ref={contentRef} dangerouslySetInnerHTML={{ __html: htmlContent }} />
  );
};

// ---------- Main Page ----------
export default function CreateQuizPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  // ✅ Quill toolbar + custom image handler
  const quillModules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike", "blockquote"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link", "image", "formula"],
          ["clean"],
        ],
        handlers: {
          image: function (this: any) {
            const url = prompt("Enter image URL");
            if (url) {
              const range = this.quill.getSelection();
              if (range) {
                this.quill.insertEmbed(range.index, "image", url, "user");
              }
            }
          },
        },
      },
    }),
    []
  );

  const quillFormats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "blockquote",
    "list",
    "bullet",
    "link",
    "image",
    "formula",
  ];

  // ---------- LocalStorage sync ----------
  useEffect(() => {
    try {
      const saved = localStorage.getItem("quizQuestions");
      if (saved) setQuestions(JSON.parse(saved));
    } catch (err) {
      console.error("Failed to load questions", err);
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("quizQuestions", JSON.stringify(questions));
  }, [questions]);

  // ---------- Handlers ----------
  const handleAddQuestion = (q: Question) => {
    setQuestions([...questions, q]);
    setIsDialogOpen(false);
  };
  const handleDeleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  // ---------- Form for a single question ----------
  const QuestionForm: React.FC<{ onSave: (q: Question) => void }> = ({
    onSave,
  }) => {
    const [questionText, setQuestionText] = useState("");
    const [options, setOptions] = useState<Option[]>([{ text: "" }, { text: "" }]);
    const [correct, setCorrect] = useState<string | null>(null);

    const updateOption = (val: string, idx: number) => {
      const newOptions = [...options];
      newOptions[idx].text = val;
      setOptions(newOptions);
    };
    const addOption = () => {
      if (options.length < 5) setOptions([...options, { text: "" }]);
    };
    const removeOption = (i: number) => {
      if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i));
    };
    const save = () => {
      if (!questionText.trim() || questionText === "<p><br></p>") {
        alert("Please enter a question.");
        return;
      }
      if (options.some((o) => !o.text.trim() || o.text === "<p><br></p>")) {
        alert("Please fill all options.");
        return;
      }
      if (correct === null) {
        alert("Select a correct answer.");
        return;
      }
      onSave({
        id: Date.now(),
        question: questionText,
        options,
        correctAnswer: parseInt(correct, 10),
      });
    };

    return (
      <div className="grid gap-6 py-4">
        {/* Question */}
        <div>
          <Label className="font-semibold mb-2 block">Question</Label>
          <QuillEditor
            theme="snow"
            value={questionText}
            onChange={setQuestionText}
            modules={quillModules}
            formats={quillFormats}
            placeholder="Type your question (supports LaTeX like x^2 and images by URL)"
          />
        </div>

        {/* Options */}
        <div>
          <Label className="font-semibold mb-2 block">Options</Label>
          <RadioGroup value={correct ?? undefined} onValueChange={setCorrect}>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-4 mb-4">
                <RadioGroupItem value={i.toString()} id={`opt-${i}`} />
                <QuillEditor
                  theme="snow"
                  value={opt.text}
                  onChange={(val: any) => updateOption(val, i)}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder={`Option ${i + 1}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeOption(i)}
                  disabled={options.length <= 2}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </RadioGroup>
        </div>

        <Button onClick={addOption} variant="outline" disabled={options.length >= 5}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Option
        </Button>

        <DialogFooter>
          <Button onClick={save}>Save Question</Button>
        </DialogFooter>
      </div>
    );
  };

  // ---------- UI ----------
  return (
    <div className="container mx-auto p-4 md:p-8 bg-gray-50 min-h-screen">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800">Create Your Quiz</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Question
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add a New Question</DialogTitle>
              <DialogDescription>
                Use the editor to create your question and options. Use the fx button
                for formulas, and the image button for images by URL.
              </DialogDescription>
            </DialogHeader>
            <QuestionForm onSave={handleAddQuestion} />
          </DialogContent>
        </Dialog>
      </header>

      <main>
        {questions.length === 0 ? (
          <div className="text-center py-16 px-8 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">
              No Questions Yet!
            </h2>
            <p className="text-gray-500">Click "Add Question" to start.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {questions.map((q, i) => (
              <Card key={q.id}>
                <CardHeader className="flex justify-between items-center bg-gray-100">
                  <CardTitle>Question {i + 1}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteQuestion(i)}
                  >
                    <Trash2 className="h-5 w-5 text-red-500" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="prose mb-6">
                    <RichTextViewer htmlContent={q.question} />
                  </div>
                  {q.options.map((opt, j) => (
                    <div
                      key={j}
                      className={`p-4 border rounded-lg flex gap-3 mb-2 ${
                        j === q.correctAnswer
                          ? "border-green-400 bg-green-50"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                          j === q.correctAnswer ? "bg-green-500" : "bg-gray-400"
                        }`}
                      >
                        {String.fromCharCode(65 + j)}
                      </div>
                      <div className="prose flex-1">
                        <RichTextViewer htmlContent={opt.text} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
