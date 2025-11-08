"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";

export function ImageUpload({
  onImageChange,
  preview = true,
  maxSize = 5,
  className = "",
  initialUrl = null,
  disabled = false,
  resetSignal = 0,
}) {
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const computedPreviewUrl = useMemo(() => {
    if (localPreviewUrl) return localPreviewUrl;
    if (initialUrl) return initialUrl;
    return null;
  }, [initialUrl, localPreviewUrl]);

  useEffect(() => {
    if (resetSignal === 0) return;
    setLocalPreviewUrl(null);
  }, [resetSignal]);

  const resetInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const validateAndProcessFile = (file) => {
    if (!file) return;

    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    if (file.size > maxSize * 1024 * 1024) {
      setError(`File size must be less than ${maxSize}MB`);
      return;
    }

    if (preview) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLocalPreviewUrl(event.target?.result || null);
      };
      reader.readAsDataURL(file);
    }

    onImageChange?.(file);
  };

  const handleFileSelect = (file) => {
    if (disabled) return;
    if (!file) return;
    validateAndProcessFile(file);
  };

  const handleInputChange = (event) => {
    const file = event.target.files?.[0];
    handleFileSelect(file || null);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    if (disabled) return;
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    handleFileSelect(file || null);
  };

  const handleRemove = (event) => {
    event.stopPropagation();
    if (disabled) return;
    setLocalPreviewUrl(null);
    setError(null);
    onImageChange?.(null);
    resetInput();
  };

  const zoneClasses = [
    "relative rounded-lg border-2 border-dashed transition-colors cursor-pointer",
    isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50",
    computedPreviewUrl ? "border-solid" : "",
    disabled ? "pointer-events-none opacity-60" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`space-y-4 ${className}`}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={zoneClasses}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
          aria-label="Upload profile image"
          disabled={disabled}
        />

        {computedPreviewUrl ? (
          <div className="relative aspect-square w-full overflow-hidden rounded-md">
            <Image
              src={computedPreviewUrl || "/placeholder.svg"}
              alt="Profile preview"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            {!disabled && (
              <div className="absolute inset-0 bg-black/0 transition-colors hover:bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100">
                <button
                  type="button"
                  onClick={handleRemove}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded-md transition-colors"
                >
                  <X className="h-4 w-4" />
                  Remove
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 p-8 py-12">
            <div className="rounded-full bg-gray-100 p-3">
              <Upload className="h-6 w-6 text-gray-600" />
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-900">Drag and drop your image here</p>
              <p className="text-sm text-gray-600">or click to select a file</p>
            </div>
            <p className="text-xs text-gray-500">Max size: {maxSize}MB • JPG, PNG, GIF</p>
          </div>
        )}
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    </div>
  );
}


