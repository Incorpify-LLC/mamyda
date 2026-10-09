/** Binary upload with real browser transport progress; completion includes server persistence. */
export function transferFile(
  url: string,
  file: File,
  onProgress: (value: number) => void,
  headers: Record<string, string> = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.timeout = 120000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new Error(
              "Upload failed. Retry, or select the files again if the upload session expired.",
            ),
          );
    xhr.onerror = () => reject(new Error("Connection interrupted. Retry this file."));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Retry this file."));
    xhr.send(file);
  });
}
