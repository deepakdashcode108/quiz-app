// Full component for creating a quiz with a rich text editor and LaTeX support.
//
// HOW TO USE THIS IN YOUR NEXT.JS PROJECT:
// 1. Make sure you have shadcn/ui setup.
// 2. Install the necessary packages and their types by running:
//    npm install react-quill katex
//    npm install --save-dev @types/katex
// 3. Create this file at `components/CreateQuiz.tsx`
// 4. Add the following CSS imports to your global stylesheet (`app/globals.css`):
//    @import "react-quill/dist/quill.snow.css";
//    @import "katex/dist/katex.min.css";
// 5. Use this component in one of your pages, e.g., `app/create-quiz/page.tsx`.
//    Since this component uses client-side features, ensure the page that uses it
//    is a Client Component by adding "use client"; to the top of the file.

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

// Type Definitions
interface Option {
  text: string;
}

interface Question {
  id: number;
  question: string;
  options: Option[];
  correctAnswer: number;
}

// Dynamic import of ReactQuill (fix for Next.js SSR issues)
const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => (
    <div className="p-4 text-center border rounded-md bg-gray-50 h-32 flex items-center justify-center">
      Loading Editor...
    </div>
  ),
});

const QuillEditor: React.FC<any> = (props) => {
  return <ReactQuill {...props} />;
};

// Component to safely render HTML content and process LaTeX formulas
const RichTextViewer: React.FC<{ htmlContent: string }> = ({ htmlContent }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      const formulaElements = contentRef.current.querySelectorAll(".ql-formula");
      formulaElements.forEach((el) => {
        const formula = el.getAttribute("data-value");
        if (formula) {
          try {
            katex.render(formula, el as HTMLElement, {
              throwOnError: false,
              displayMode: el.tagName === "DIV",
            });
          } catch (e) {
            console.error("KaTeX rendering error:", e);
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

export default function CreateQuizPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike", "blockquote"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "image", "formula"],
        ["clean"],
      ],
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

  useEffect(() => {
    try {
      const savedQuestions = localStorage.getItem("quizQuestions");
      if (savedQuestions) {
        setQuestions(JSON.parse(savedQuestions) as Question[]);
      }
    } catch (error) {
      console.error("Failed to parse questions from localStorage", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("quizQuestions", JSON.stringify(questions));
  }, [questions]);

  const handleAddQuestion = (newQuestion: Question) => {
    setQuestions([...questions, newQuestion]);
    setIsDialogOpen(false);
  };

  const handleDeleteQuestion = (indexToDelete: number) => {
    setQuestions(questions.filter((_, index) => index !== indexToDelete));
  };

  const QuestionForm: React.FC<{ onSave: (question: Question) => void }> = ({
    onSave,
  }) => {
    const [questionText, setQuestionText] = useState<string>("");
    const [options, setOptions] = useState<Option[]>([
      { text: "" },
      { text: "" },
    ]);
    const [correctOptionIndex, setCorrectOptionIndex] = useState<string | null>(
      null
    );

    const handleOptionTextChange = (value: string, index: number) => {
      const newOptions = [...options];
      newOptions[index].text = value;
      setOptions(newOptions);
    };

    const handleAddOption = () => {
      if (options.length < 5) {
        setOptions([...options, { text: "" }]);
      }
    };

    const handleRemoveOption = (indexToRemove: number) => {
      if (options.length > 2) {
        setOptions(options.filter((_, index) => index !== indexToRemove));
      }
    };

    const handleSubmit = () => {
      if (!questionText.trim() || questionText === "<p><br></p>") {
        alert("Please enter a question.");
        return;
      }
      if (options.some((opt) => !opt.text.trim() || opt.text === "<p><br></p>")) {
        alert("Please ensure all options have text.");
        return;
      }
      if (correctOptionIndex === null) {
        alert("Please select a correct answer.");
        return;
      }

      const newQuestion: Question = {
        id: Date.now(),
        question: questionText,
        options: options,
        correctAnswer: parseInt(correctOptionIndex, 10),
      };
      onSave(newQuestion);
    };

    return (
      <div className="grid gap-6 py-4">
        <div>
          <Label
            htmlFor="question"
            className="text-lg font-semibold mb-2 block"
          >
            Question
          </Label>
          <div className="bg-white rounded-md">
            <QuillEditor
              theme="snow"
              value={questionText}
              onChange={setQuestionText}
              modules={quillModules}
              formats={quillFormats}
              placeholder="Type your question here, e.g., What is $$x^2$$?"
            />
          </div>
        </div>
        <div>
          <Label className="text-lg font-semibold mb-2 block">Options</Label>
          <RadioGroup
            value={correctOptionIndex ?? undefined}
            onValueChange={setCorrectOptionIndex}
          >
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-4 mb-4">
                <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                <div className="flex-grow bg-white rounded-md">
                  <QuillEditor
                    theme="snow"
                    value={option.text}
                    onChange={(value) => handleOptionTextChange(value, index)}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder={`Option ${index + 1}`}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveOption(index)}
                  disabled={options.length <= 2}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </RadioGroup>
        </div>
        <Button
          variant="outline"
          onClick={handleAddOption}
          disabled={options.length >= 5}
          className="w-full"
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Add Option
        </Button>
        <DialogFooter>
          <Button onClick={handleSubmit} className="w-full sm:w-auto">
            Save Question
          </Button>
        </DialogFooter>
      </div>
    );
  };

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
              <DialogTitle className="text-2xl">Add a New Question</DialogTitle>
              <DialogDescription>
                Use the editor to create your question and options. Use the 'fx'
                button for mathematical formulas.
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
            <p className="text-gray-500">
              Click "Add Question" to start building your quiz.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {questions.map((q, index) => (
              <Card key={q.id} className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between bg-gray-100 p-4">
                  <CardTitle className="text-xl">Question {index + 1}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteQuestion(index)}
                  >
                    <Trash2 className="h-5 w-5 text-red-500" />
                  </Button>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="prose max-w-none mb-6">
                    <RichTextViewer htmlContent={q.question} />
                  </div>
                  <div className="space-y-3">
                    {q.options.map((opt, optIndex) => (
                      <div
                        key={optIndex}
                        className={`p-4 border rounded-lg flex items-start gap-3 ${
                          optIndex === q.correctAnswer
                            ? "border-green-400 bg-green-50"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                            optIndex === q.correctAnswer
                              ? "bg-green-500"
                              : "bg-gray-400"
                          }`}
                        >
                          {String.fromCharCode(65 + optIndex)}
                        </div>
                        <div className="prose max-w-none flex-1">
                          <RichTextViewer htmlContent={opt.text} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
