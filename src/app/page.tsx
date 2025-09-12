"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import katex from "katex";
import "katex/dist/katex.min.css";
import "react-quill-new/dist/quill.snow.css";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

if (typeof window !== "undefined") {
  (window as any).katex = katex;
}

// lazy load react-quill (avoids SSR issues)
const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

type Option = {
  text: string;
  isCorrect?: boolean;
};

type Question = {
  id: string;
  text: string;
  options: Option[];
};

const quillFormats = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "blockquote",
  "list",
  "link",
  "image",
  "formula",
];

// --------- RichTextViewer (renders HTML + KaTeX) ----------
const RichTextViewer: React.FC<{ content: string }> = ({ content }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      const el = ref.current;
      el.querySelectorAll("span.ql-formula").forEach((node) => {
        const latex = node.getAttribute("data-value") || "";
        try {
          node.innerHTML = katex.renderToString(latex, {
            throwOnError: false,
            displayMode: false,
          });
        } catch {
          node.innerHTML = `<span class="text-red-500">Invalid formula</span>`;
        }
      });
    }
  }, [content]);

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: content }} />;
};

// --------- LatexEditor (dialog content) ----------
const LatexEditor: React.FC<{ onInsert: (latex: string) => void }> = ({ onInsert }) => {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  let previewHtml = "";
  try {
    previewHtml = katex.renderToString(input, {
      throwOnError: true,
      displayMode: true,
    });
    if (error) setError(null);
  } catch (err: any) {
    if (!error) setError(err.message);
  }

  return (
    <div className="space-y-4">
      <Textarea
        placeholder="Type LaTeX here, e.g. \\frac{1}{x^2+1}"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="font-mono h-24"
      />

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-red-500 text-sm">{error}</p>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          )}
        </CardContent>
      </Card>

      <Button
        onClick={() => {
          if (input.trim()) {
            onInsert(input);
            setInput("");
          }
        }}
      >
        Insert Formula
      </Button>
    </div>
  );
};

// --------- QuestionForm (with Quill + formula dialog) ----------
const QuestionForm: React.FC<{ onSave: (q: Question) => void }> = ({ onSave }) => {
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState<Option[]>([{ text: "" }, { text: "" }]);
  const [correct, setCorrect] = useState<string | null>(null);

  const [showLatexDialog, setShowLatexDialog] = useState(false);
  const [activeEditor, setActiveEditor] = useState<{ type: "question" | "option"; index?: number } | null>(null);

  const quillRef = useRef<any>(null);
  const optionRefs = useRef<any[]>([]);

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
          formula: function (this: any) {
            // figure out which editor triggered this
            if (this.quill === quillRef.current?.getEditor()) {
              setActiveEditor({ type: "question" });
            } else {
              const idx = optionRefs.current.findIndex(
                (ref) => ref?.getEditor && ref.getEditor() === this.quill
              );
              if (idx !== -1) {
                setActiveEditor({ type: "option", index: idx });
              }
            }
            setShowLatexDialog(true);
          },
        },
      },
    }),
    []
  );

  const handleInsertFormula = (latex: string) => {
    if (!activeEditor) return;

    if (activeEditor.type === "question" && quillRef.current) {
      const editor = quillRef.current.getEditor();
      const range = editor.getSelection(true);
      editor.insertEmbed(range.index, "formula", latex, "user");
    }

    if (activeEditor.type === "option" && activeEditor.index !== undefined) {
      const optRef = optionRefs.current[activeEditor.index];
      if (optRef) {
        const editor = optRef.getEditor();
        const range = editor.getSelection(true);
        editor.insertEmbed(range.index, "formula", latex, "user");
      }
    }

    setShowLatexDialog(false);
    setActiveEditor(null);
  };

  const saveQuestion = () => {
    if (!questionText.trim()) return alert("Enter a question!");
    if (options.some((o) => !o.text.trim())) return alert("All options required!");
    if (correct === null) return alert("Select correct answer!");

    onSave({
      id: Date.now().toString(),
      text: questionText,
      options: options.map((o, i) => ({ ...o, isCorrect: correct === i.toString() })),
    });

    setQuestionText("");
    setOptions([{ text: "" }, { text: "" }]);
    setCorrect(null);
  };

  return (
    <div className="grid gap-6 py-4">
      {/* Question */}
      <div>
        <Label className="font-semibold mb-2 block">Question</Label>
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={questionText}
          onChange={setQuestionText}
          modules={quillModules}
          formats={quillFormats}
          placeholder="Type your question (supports LaTeX with fx button)"
        />
      </div>

      {/* Options */}
      <div>
        <Label className="font-semibold mb-2 block">Options</Label>
        <div className="space-y-4">
          {options.map((opt, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1">
                <ReactQuill
                  ref={(el) => (optionRefs.current[i] = el)}
                  theme="snow"
                  value={opt.text}
                  onChange={(val) => {
                    const newOpts = [...options];
                    newOpts[i].text = val;
                    setOptions(newOpts);
                  }}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder={`Option ${i + 1}`}
                />
              </div>
              <input
                type="radio"
                name="correct"
                checked={correct === i.toString()}
                onChange={() => setCorrect(i.toString())}
              />
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          className="mt-2"
          onClick={() => setOptions([...options, { text: "" }])}
        >
          Add Option
        </Button>
      </div>

      <Button onClick={saveQuestion}>Save Question</Button>

      {/* LaTeX Dialog */}
      <Dialog open={showLatexDialog} onOpenChange={setShowLatexDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Insert Formula</DialogTitle>
          </DialogHeader>
          <LatexEditor onInsert={handleInsertFormula} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// --------- CreateQuizPage (main) ----------
export default function CreateQuizPage() {
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("quizQuestions");
    if (saved) setQuestions(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("quizQuestions", JSON.stringify(questions));
  }, [questions]);

  const handleSaveQuestion = (q: Question) => {
    setQuestions([...questions, q]);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Quiz</CardTitle>
        </CardHeader>
        <CardContent>
          <QuestionForm onSave={handleSaveQuestion} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {questions.map((q) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle>
                <RichTextViewer content={q.text} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-6 space-y-1">
                {q.options.map((opt, i) => (
                  <li key={i} className={opt.isCorrect ? "font-bold text-green-600" : ""}>
                    <RichTextViewer content={opt.text} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
