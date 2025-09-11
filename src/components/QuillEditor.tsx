"use client";

import dynamic from "next/dynamic";

// Load ReactQuill only on the client
const ReactQuill = dynamic(() => import("react-quill"), {
  ssr: false,
  loading: () => (
    <div className="p-4 text-center border rounded-md bg-gray-50 h-32 flex items-center justify-center">
      Loading Editor...
    </div>
  ),
});

export default ReactQuill;
