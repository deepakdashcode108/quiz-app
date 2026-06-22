"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import katex from "katex";
import "katex/dist/katex.min.css";
import type ReactQuillType from "react-quill-new";
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
import { GetAllDomain } from "@/Helper/Services/DomainServices/GetAllDomain"
import { GetAllSubjects } from "@/Helper/Services/SubjectServices/GetAllSubject"
import { AddDomain } from "@/Helper/Services/DomainServices/AddDomain"
import { AddSubject } from "@/Helper/Services/SubjectServices/AddSubject"
import { AttachTagsToQuestion, CreateTag, GetAllTags } from "@/Helper/Services/TagServices/tagService";
import { Badge } from "@/components/ui/badge";

if (typeof window !== "undefined") {
    (window as any).katex = katex;
}

// const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });
const ReactQuill = dynamic(
    () => import("react-quill-new"),
    { ssr: false }
) as typeof ReactQuillType;
// --- Types ---

type Option = {
    option?: string; // a, b, c, d
    text: string;
    isCorrect?: boolean;
};

// Matches your backend SQLModel
type Question = {
    id?: string | number; // Optional for backend creation
    text: string;
    type: string;
    min_value: number | null;
    max_value: number | null;
    options: Option[] | null; // JSON column
    correct_answer: string; // e.g. "ab"
    explanation: string;
    domain_id: number;
    subject_id: number;
    marks: number;
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
    const [correct, setCorrect] = useState<string[] | null>([]); // Array of indices as strings ["0", "1"]
    const [explanation, setExplanation] = useState("");
    const [minValue, setMinValue] = useState<number>(0);
    const [maxValue, setMaxValue] = useState<number>(0);
    const [marks, setMarks] = useState<number>(1.0); // Default marks
    const [showLatexDialog, setShowLatexDialog] = useState(false);
    const [activeEditor, setActiveEditor] = useState<{
        type: "question" | "option" | "explanation";
        index?: number;
    } | null>(null);

    const quillRef = useRef<any>(null);
    const optionRefs = useRef<any[]>([]);
    const explanationRef = useRef<any>(null);


    // Tags related styates
    const [tags, setTags] = useState<Tag[]>([]);
    const [newTag, setNewTag] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchTags = async () => {
        try {
            const data = await GetAllTags();
            //   console.log('Data is ', data)
            setTags(data.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateTag = async () => {
        if (!newTag.trim()) return;

        try {
            setLoading(true);
            await CreateTag(newTag);
            setNewTag("");
            fetchTags();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const toggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(selectedTags.filter((t) => t !== tag));
        } else {
            setSelectedTags([...selectedTags, tag]);
        }
        console.log('current tags are ', selectedTags)
    };

    useEffect(() => {
        fetchTags();
    }, [])
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
                        let range = this.quill.getSelection();
                        const url = prompt("Enter image URL");
                        if (url) {
                            if (!range) {
                                range = { index: this.quill.getLength() };
                            }
                            this.quill.insertEmbed(range.index, "image", url, "user");
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
        if (typeofquestion !== "NAT" && options.some((o) => !o.text.trim())) return alert("All options required!");
        if (typeofquestion !== "NAT" && (!correct || correct.length === 0)) return alert("Select correct answer!");
        if (!explanation.trim()) return alert("Enter explanation!");
        if (!selecteddomain || !selectedsubject) return alert("domain and subject required");

        // --- LOGIC CHANGE START ---

        const optionLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        let correctAnswerStr = "";
        let formattedOptions: Option[] | null = null;

        if (typeofquestion === "MCQ" || typeofquestion === "MSQ") {
            formattedOptions = options.map((o, i) => {
                const isCorrect = correct?.includes(i.toString());
                if (isCorrect) {
                    correctAnswerStr += optionLetters[i]; // Concatenate letters: "a" + "b" -> "ab"
                }
                return {
                    option: optionLetters[i], // "a", "b", etc.
                    text: o.text,
                    isCorrect: isCorrect // Optional, but good for frontend checking
                };
            });
        }

        const data: Question = {
            id: Date.now().toString(), // Helper ID for frontend list
            text: questionText,
            type: typeofquestion,
            min_value: typeofquestion === "NAT" ? Number(minValue) : null,
            max_value: typeofquestion === "NAT" ? Number(maxValue) : null,
            options: formattedOptions,
            correct_answer: correctAnswerStr,
            explanation,
            domain_id: Number(selecteddomain),
            subject_id: Number(selectedsubject),
            marks: Number(marks)
        }

        // --- LOGIC CHANGE END ---

        onSave(data);
        console.log("Payload:", data);

        try {
            const res = await AddQuestion(Number(selecteddomain), data);
            console.log('res inside is ', res);
            console.log('selected tags that are sent to backend', selectedTags)
            const addTagToQuestionResponse = await AttachTagsToQuestion(res.data.id, selectedTags);
            setSelectedTags([]);
        } catch (error) {
            console.error("Failed to save to backend:", error);
        }

        // Reset Form
        setQuestionText("");
        setOptions([{ text: "" }, { text: "" }]);
        setCorrect([]);
        setExplanation("");
        setMinValue(0);
        setMaxValue(0);
        setMarks(1.0);
    };


    const togglecorrect = (optionId: string) => {
        if (correct?.includes(optionId)) {
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

            {/* Marks Input */}
            <div>
                <Label className="font-semibold mb-2 block">Marks</Label>
                <Input
                    type="number"
                    placeholder="Enter marks"
                    value={marks}
                    onChange={(e) => setMarks(Number(e.target.value))}
                    step="0.5"
                    min="0"
                />
            </div>

            {typeofquestion === "NAT" ? (
                <>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <Label className="font-semibold mb-2 block">Min Value</Label>
                            <Input
                                type="number"
                                name="minvalue"
                                placeholder="min value"
                                value={minValue ?? ""}
                                onChange={(e) => setMinValue(Number(e.target.value))}
                            />
                        </div>
                        <div className="flex-1">
                            <Label className="font-semibold mb-2 block">Max Value</Label>
                            <Input
                                type="number"
                                name="maxvalue"
                                placeholder="max value"
                                value={maxValue ?? ""}
                                onChange={(e) => setMaxValue(Number(e.target.value))}
                            />
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* Options */}
                    <div>
                        <Label className="font-semibold mb-2 block">Options</Label>
                        <div className="space-y-4">
                            {options.map((opt, i) => (
                                <div key={i} className="flex items-start gap-2">
                                    <span className="mt-2 font-mono font-bold text-gray-500">{String.fromCharCode(97 + i)}.</span>
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
                                        className="mt-3 w-5 h-5"
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
                </>
            )}

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

            <div className="p-8">
                <Card>
                    <CardContent className="space-y-6 pt-6">

                        {/* Create Tag */}
                        <div className="flex gap-3">
                            <Input
                                placeholder="Enter new tag name"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                            />

                            <Button onClick={handleCreateTag} disabled={loading}>
                                Create Tag
                            </Button>
                        </div>

                        {/* Tag List */}
                        <div className="flex flex-wrap gap-3">
                            {tags.map((tag) => (
                                <Badge
                                    key={tag.id}
                                    variant={selectedTags.includes(tag.name) ? "default" : "outline"}
                                    className="cursor-pointer text-sm px-3 py-1"
                                    onClick={() => toggleTag(tag.name)}
                                >
                                    {tag.name}
                                </Badge>
                            ))}
                        </div>

                        {/* Attach Button */}
                        {/* <Button onClick={attachTags} disabled={selectedTags.length === 0}>
                            Attach Selected Tags
                        </Button> */}

                    </CardContent>
                </Card>
            </div>
            <Button onClick={saveQuestion} className="w-full">Save Question</Button>

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
interface Tag {
    id: number;
    name: string;
}

export default function Modal() {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [domains, setDomains] = useState<Array<DomainCall> | null>();
    const [subjects, setSubjects] = useState<Array<SubjectCall> | null>();
    const [selectedsubject, setSelectedSubject] = useState("");
    const [selecteddomain, setselectdDomain] = useState("");
    const [questiontype, setquestionTyoe] = useState("");

    const [showDomainDialog, setShowDomainDialog] = useState(false);
    const [newDomainName, setNewDomainName] = useState("");
    const [domainLoading, setDomainLoading] = useState(false);

    const [showSubjectDialog, setShowSubjectDialog] = useState(false);
    const [newSubjectName, setNewSubjectName] = useState("");
    const [subjectLoading, setSubjectLoading] = useState(false);

    async function fetchDomains() {
        try {
            const result = await GetAllDomain();
            setDomains(result.data);
        } catch (error) {
            console.log(error);
        }
    }


    // Tag related states
    // const [tags, setTags] = useState<Tag[]>([]);
    // const [newTag, setNewTag] = useState("");
    // const [selectedTags, setSelectedTags] = useState<string[]>([]);
    // const [loading, setLoading] = useState(false);

    // const fetchTags = async () => {
    //     try {
    //         const data = await GetAllTags();
    //         //   console.log('Data is ', data)
    //         setTags(data.data);
    //     } catch (err) {
    //         console.error(err);
    //     }
    // };
    useEffect(() => {
        const saved = localStorage.getItem("quizQuestions");
        if (saved) setQuestions(JSON.parse(saved));
        // fetchTags();
    }, []);

    useEffect(() => {
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
        } catch (error) {
            console.log(error);
        }
    }

    const handleSaveQuestion = (q: Question) => {
        setQuestions([...questions, q]);
    };

    const handleCreateDomain = async () => {
        if (!newDomainName.trim()) return;
        try {
            setDomainLoading(true);
            await AddDomain({ name: newDomainName });
            setNewDomainName("");
            setShowDomainDialog(false);
            await fetchDomains();
        } catch (error) {
            console.log(error);
            alert("Failed to create domain");
        } finally {
            setDomainLoading(false);
        }
    };

    const handleCreateSubject = async () => {
        if (!newSubjectName.trim() || !selecteddomain) return;
        try {
            setSubjectLoading(true);
            await AddSubject(selecteddomain, { name: newSubjectName });
            setNewSubjectName("");
            setShowSubjectDialog(false);
            await collectsubject(selecteddomain);
        } catch (error) {
            console.log(error);
            alert("Failed to create subject");
        } finally {
            setSubjectLoading(false);
        }
    };
    // const handleCreateTag = async () => {
    //     if (!newTag.trim()) return;

    //     try {
    //         setLoading(true);
    //         await CreateTag(newTag);
    //         setNewTag("");
    //         fetchTags();
    //     } catch (err) {
    //         console.error(err);
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    // const toggleTag = (tag: string) => {
    //     if (selectedTags.includes(tag)) {
    //         setSelectedTags(selectedTags.filter((t) => t !== tag));
    //     } else {
    //         setSelectedTags([...selectedTags, tag]);
    //     }
    // };

    //   const attachTags = async () => {
    //     if (selectedTags.length === 0) return;

    //     try {
    //       await AttachTagsToQuestion(questionId, selectedTags);
    //       alert("Tags attached successfully");
    //     } catch (err) {
    //       console.error(err);
    //     }
    //   };

    return (
        <div className="container mx-auto p-6 space-y-6">
            
            <Card>
                <div className="flex flex-wrap gap-4 p-4 items-end">

                    <div className="grid gap-2">
                        <Label>Select Domain</Label>
                        <div className="flex gap-2">
                            <Select onValueChange={(value) => collectsubject(value)}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Domain" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Domain</SelectLabel>
                                        {domains && domains.map(element => (
                                            <SelectItem key={element.id} value={element.id.toString()}>
                                                {element.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon" onClick={() => setShowDomainDialog(true)}>
                                +
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Select Subject</Label>
                        <div className="flex gap-2">
                            <Select onValueChange={(value) => setSelectedSubject(value)}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Subject" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Subject</SelectLabel>
                                        {subjects && subjects.map(element => (
                                            <SelectItem key={element.id} value={element.id.toString()}>
                                                {element.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon" onClick={() => setShowSubjectDialog(true)} disabled={!selecteddomain}>
                                +
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Question Type</Label>
                        <Select onValueChange={(value) => setquestionTyoe(value)}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>Type</SelectLabel>
                                    <SelectItem value="MCQ">MCQ</SelectItem>
                                    <SelectItem value="MSQ">MSQ</SelectItem>
                                    <SelectItem value="NAT">NAT</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <CardHeader>
                    <CardTitle>Add New Question</CardTitle>
                </CardHeader>
                <CardContent>
                    <QuestionForm
                        onSave={handleSaveQuestion}
                        selectedsubject={selectedsubject}
                        selecteddomain={selecteddomain}
                        typeofquestion={questiontype}
                    />
                </CardContent>
            </Card>

            <div className="space-y-4">
                <Label className="text-xl font-bold">Saved Questions Preview</Label>
                {questions.map((q, idx) => (
                    <Card key={idx}>
                        <CardHeader className="flex flex-row justify-between items-start">
                            <CardTitle className="text-lg">
                                <span className="font-bold mr-2">Q{idx + 1}.</span>
                                <RichTextViewer content={q.text} />
                            </CardTitle>
                            <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                                Marks: {q.marks} | Type: {q.type}
                            </span>
                        </CardHeader>
                        <CardContent>
                            {q.type === 'NAT' ? (
                                <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded">
                                    <strong>Range:</strong> {q.min_value} - {q.max_value}
                                </div>
                            ) : (
                                <ul className="list-none pl-0 space-y-2 mb-4">
                                    {q.options && q.options.map((opt, i) => (
                                        <li
                                            key={i}
                                            className={`flex gap-2 p-2 rounded ${q.correct_answer.includes(opt.option || '') ? "bg-green-50 border border-green-200" : "bg-gray-50"}`}
                                        >
                                            <span className="font-bold">{opt.option}.</span>
                                            <RichTextViewer content={opt.text} />
                                            {q.correct_answer.includes(opt.option || '') && <span className="ml-auto text-green-600 font-bold">✓</span>}
                                        </li>
                                    ))}
                                </ul>
                            )}

                            <div className="mt-4 pt-4 border-t">
                                <Label className="block font-semibold text-gray-700">Explanation:</Label>
                                <div className="text-sm text-gray-600 mt-1">
                                    <RichTextViewer content={q.explanation} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Create Domain Dialog */}
            <Dialog open={showDomainDialog} onOpenChange={setShowDomainDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Domain</DialogTitle>
                    </DialogHeader>
                    <Input
                        placeholder="Domain Name"
                        value={newDomainName}
                        onChange={(e) => setNewDomainName(e.target.value)}
                    />
                    <Button onClick={handleCreateDomain} disabled={domainLoading}>
                        Create Domain
                    </Button>
                </DialogContent>
            </Dialog>

            {/* Create Subject Dialog */}
            <Dialog open={showSubjectDialog} onOpenChange={setShowSubjectDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Subject</DialogTitle>
                    </DialogHeader>
                    <Input
                        placeholder="Subject Name"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                    />
                    <Button onClick={handleCreateSubject} disabled={subjectLoading}>
                        Create Subject
                    </Button>
                </DialogContent>
            </Dialog>
        </div>
    );
}