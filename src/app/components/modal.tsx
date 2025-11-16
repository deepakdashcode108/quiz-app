"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import katex from "katex";
import "katex/dist/katex.min.css";
import "react-quill-new/dist/quill.snow.css";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AddQuestion } from "@/Helper/Services/QuestionServices/AddQuestion"

if (typeof window !== "undefined") {
    (window as any).katex = katex;
}

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

type Option = {
    text: string;
    isCorrect?: boolean;
};

type Question = {
    id: string;
    text: string;
    options: Option[];
    explanation: string;
    type: string,
    min_value: number,
    max_value: number,
    subject_id: string
};

type DomainCall = {
    id: number,
    name: string
}

type SubjectCall = {
    id: number,
    name: string,
    domainid: number
}

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

import { GetAllDomain } from "@/Helper/Services/DomainServices/GetAllDomain"
import { GetAllSubjects } from "@/Helper/Services/SubjectServices/GetAllSubject"

// --------- RichTextViewer ----------
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

// --------- LatexEditor ----------
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

// --------- QuestionForm ----------
const QuestionForm: React.FC<{ onSave: (q: Question) => void, selectedsubject: string, selecteddomain: string, typeofquestion: string }> = ({ onSave, selectedsubject, selecteddomain, typeofquestion }) => {
    const [questionText, setQuestionText] = useState("");
    const [options, setOptions] = useState<Option[]>([{ text: "" }, { text: "" }]);
    const [correct, setCorrect] = useState<string[] | null>([]);
    const [explanation, setExplanation] = useState("");
    const [minValue, setMinValue] = useState<number>(0);
    const [maxValue, setMaxValue] = useState<number>(0);
    const [showLatexDialog, setShowLatexDialog] = useState(false);
    const [activeEditor, setActiveEditor] = useState<{
        type: "question" | "option" | "explanation";
        index?: number;
    } | null>(null);

    const quillRef = useRef<any>(null);
    const optionRefs = useRef<any[]>([]);
    const explanationRef = useRef<any>(null);

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
                        if (this.quill === quillRef.current?.getEditor()) {
                            setActiveEditor({ type: "question" });
                        } else if (this.quill === explanationRef.current?.getEditor()) {
                            setActiveEditor({ type: "explanation" });
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

        if (activeEditor.type === "explanation" && explanationRef.current) {
            const editor = explanationRef.current.getEditor();
            const range = editor.getSelection(true);
            editor.insertEmbed(range.index, "formula", latex, "user");
        }

        setShowLatexDialog(false);
        setActiveEditor(null);
    };

    const saveQuestion = async () => {
        if (!questionText.trim()) return alert("Enter a question!");
        if(!typeofquestion) return alert(" Question type is required");
        if(typeofquestion==="NAT") setOptions([]);
        if (typeofquestion!="NAT" && options.some((o) => !o.text.trim())) return alert("All options required!");
        if (typeofquestion!="NAT" && correct?.length==0) return alert("Select correct answer!");
        if (!explanation.trim()) return alert("Enter explanation!");
        if (!selecteddomain || !selectedsubject) return alert("domain and subject required");
        

        const data = {
            id: Date.now().toString(),
            text: questionText,
            options: options.map((o, i) => ({
                ...o,
                isCorrect: correct?.includes(i.toString()),
            })),
            explanation,
            subject_id: selectedsubject,
            min_value: minValue,
            max_value: maxValue,
            type: typeofquestion
        }

        onSave(data);
        console.log(data);

        try {
            const result = await AddQuestion(Number(selecteddomain), data);
        } catch (error) {

        }

        setQuestionText("");
        setOptions([{ text: "" }, { text: "" }]);
        setCorrect([]);
        setExplanation("");
    };


    const togglecorrect = (optionId: string) => {
        console.log(correct);
        // if (!correct) return;
        if (correct?.includes(optionId)) {
            console.log(0);
            setCorrect(correct?.filter(id => id !== optionId));
        } else {
            if (!correct) setCorrect([optionId])
            else
                setCorrect([...correct, optionId]);
        }
    }

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
                    placeholder="Type your question..."
                />
            </div>

            {typeofquestion === "NAT" ? <>

                <div>
                    <Label className="font-semibold mb-2 block">Ans</Label>

                    <input
                        type="number"
                        name="minvalue"
                        placeholder="min value"
                        className="border"
                        value={minValue ?? ""}
                        onChange={(e) => setMinValue(Number(e.target.value))}
                    />

                    <input
                        type="number"
                        name="maxvalue"
                        placeholder="max value"
                        className="border"
                        value={maxValue ?? ""}
                        onChange={(e) => setMaxValue(Number(e.target.value))}
                    />
                </div>

            </> : <>

                {/* Options */}
                <div>
                    <Label className="font-semibold mb-2 block">Options</Label>
                    <div className="space-y-4">
                        {options.map((opt, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <div className="flex-1">
                                    <ReactQuill
                                        ref={(el: any) => (optionRefs.current[i] = el)}
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
                                    type="checkbox"
                                    name="correct"
                                    checked={correct?.includes(i.toString())}
                                    onChange={() => togglecorrect(i.toString())}
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
            </>}



            {/* Explanation */}
            <div>
                <Label className="font-semibold mb-2 block">Explanation</Label>
                <ReactQuill
                    ref={explanationRef}
                    theme="snow"
                    value={explanation}
                    onChange={setExplanation}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="Add explanation for the answer..."
                />
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

// --------- CreateQuizPage ----------

export default function Modal() {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [domains, setDomains] = useState<Array<DomainCall> | null>();
    const [subjects, setSubjects] = useState<Array<SubjectCall> | null>();
    const [selectedsubject, setSelectedSubject] = useState("");
    const [selecteddomain, setselectdDomain] = useState("");
    const [questiontype, setquestionTyoe] = useState("");

    useEffect(() => {
        const saved = localStorage.getItem("quizQuestions");
        if (saved) setQuestions(JSON.parse(saved));
    }, []);

    useEffect(() => {
        async function fetchDomains() {
            try {
                const result = await GetAllDomain();
                console.log(result.data);

                // const enriched = enrichDomains(result.data);
                setDomains(result.data);
            } catch (error) {
                console.log(error);
                // fallback or retry logic if needed
            }
        }

        fetchDomains();
    }, []);


    useEffect(() => {
        localStorage.setItem("quizQuestions", JSON.stringify(questions));
    }, [questions]);


    const collectsubject = async (domainid: string) => {
        try {
            setselectdDomain(domainid);
            const result = await GetAllSubjects(domainid);
            setSubjects(result?.data);
            console.log(result?.data);

        } catch (error) {

        }
    }

    const handleSaveQuestion = (q: Question) => {
        setQuestions([...questions, q]);
    };

    return (
        <div className="container mx-auto p-6 space-y-6">

            <Card>

                <Select>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select a Domain" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Domain</SelectLabel>
                            {
                                domains &&
                                domains!.map(element => {
                                    return <SelectItem key={element?.id.toString()} value={element?.id.toString()} onClick={() => collectsubject(element?.id.toString())}>{element.name}</SelectItem>
                                })
                            }
                        </SelectGroup>
                    </SelectContent>
                </Select>

                <Select>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select a Subject" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Subject</SelectLabel>
                            {
                                subjects &&
                                subjects!.map(element => {
                                    return <SelectItem key={element?.id.toString()} value={element?.id.toString()} onClick={() => setSelectedSubject(element?.id.toString())} >{element.name}</SelectItem>
                                })
                            }
                        </SelectGroup>
                    </SelectContent>
                </Select>

                <Select>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Type of Question" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Question Type</SelectLabel>
                            <SelectItem value="MCQ" onClick={() => setquestionTyoe("MCQ")}>MCQ</SelectItem>
                            <SelectItem value="MSQ" onClick={() => setquestionTyoe("MSQ")} >MSQ</SelectItem>
                            <SelectItem value="NAT" onClick={() => setquestionTyoe("NAT")}>NAT</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
                <CardHeader>
                    <CardTitle>Create Quiz</CardTitle>
                </CardHeader>
                <CardContent>
                    <QuestionForm onSave={handleSaveQuestion} selectedsubject={selectedsubject} selecteddomain={selecteddomain} typeofquestion={questiontype} />
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
                                    <li
                                        key={i}
                                        className={opt.isCorrect ? "font-bold text-green-600" : ""}
                                    >
                                        <RichTextViewer content={opt.text} />
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-4">
                                <Label className="block font-semibold">Explanation:</Label>
                                <RichTextViewer content={q.explanation} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
