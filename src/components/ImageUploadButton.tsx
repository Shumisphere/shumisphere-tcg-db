import React, { useRef, useState } from "react";
import { Upload, Loader2, XCircle } from "lucide-react";

const CLOUD_NAME = "dbc09pvx2";
const UPLOAD_PRESET = "lotteryiq_uploads";

interface Props {
    onUpload: (url: string) => void;
    className?: string;
}

export function ImageUploadButton({ onUpload, className = "" }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", UPLOAD_PRESET);
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                method: "POST",
                body: formData,
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData?.error?.message || `Upload failed (${res.status})`);
            }
            const data = await res.json();
            onUpload(data.secure_url);
        } catch (err: any) {
            setError(err.message || "Upload failed");
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    }

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
            />
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="px-3 py-2 bg-brand-accent/20 hover:bg-brand-accent/30 border border-brand-accent/40 text-brand-accent rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0"
            >
                {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                <span>{uploading ? "Uploading..." : "Upload"}</span>
            </button>
            {error && (
                <span className="text-[9px] text-rose-400 font-mono flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {error}
                </span>
            )}
        </div>
    );
}
