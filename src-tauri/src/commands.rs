//! Comandos Tauri — FFmpeg/FFprobe como sidecars.
//! Suporta exportação em MP4 (H.264+AAC), MP3 (áudio) e GIF animado.

use serde::{Deserialize, Serialize};
use tauri::api::process::{Command, CommandEvent};

#[derive(Debug, Serialize)]
pub struct MediaProbe {
    pub path: String,
    pub kind: String,
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Segment {
    pub path: String,
    #[serde(rename = "inPoint")]
    pub in_point: f64,
    pub duration: f64,
}

#[derive(Debug, Deserialize)]
pub struct ExportRequest {
    pub segments: Vec<Segment>,
    #[serde(rename = "outputPath")]
    pub output_path: String,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    /// "mp4" | "mp3" | "gif"
    pub format: String,
}

#[derive(Debug, Clone, Serialize)]
struct ExportProgress {
    progress: f64,
    done: bool,
    output: Option<String>,
}

/* ------------------------------------------------------------------ */
/* ffprobe helpers                                                     */
/* ------------------------------------------------------------------ */

fn run_ffprobe(args: &[&str]) -> Result<String, String> {
    let output = Command::new_sidecar("ffprobe")
        .map_err(|e| format!("ffprobe sidecar indisponível: {e}"))?
        .args(args)
        .output()
        .map_err(|e| format!("falha ao executar ffprobe: {e}"))?;
    if !output.status.success() {
        return Err(format!("ffprobe falhou: {}", output.stderr));
    }
    Ok(output.stdout)
}

fn eval_rate(rate: &str) -> f64 {
    if let Some((n, d)) = rate.split_once('/') {
        let n: f64 = n.parse().unwrap_or(0.0);
        let d: f64 = d.parse().unwrap_or(1.0);
        if d != 0.0 { return n / d; }
    }
    rate.parse().unwrap_or(0.0)
}

fn is_image_ext(path: &str) -> bool {
    let lower = path.to_lowercase();
    [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tiff"]
        .iter().any(|e| lower.ends_with(e))
}

fn has_audio(path: &str) -> bool {
    run_ffprobe(&["-v","quiet","-select_streams","a","-show_entries","stream=index","-of","csv=p=0",path])
        .map(|out| !out.trim().is_empty())
        .unwrap_or(false)
}

/* ------------------------------------------------------------------ */
/* probe_media                                                         */
/* ------------------------------------------------------------------ */

#[tauri::command]
pub async fn probe_media(path: String) -> Result<MediaProbe, String> {
    let json = run_ffprobe(&["-v","quiet","-print_format","json","-show_format","-show_streams",&path])?;
    let v: serde_json::Value = serde_json::from_str(&json).map_err(|e| format!("JSON inválido: {e}"))?;

    let streams = v["streams"].as_array().cloned().unwrap_or_default();
    let video = streams.iter().find(|s| s["codec_type"] == "video");
    let audio = streams.iter().find(|s| s["codec_type"] == "audio");

    let duration = v["format"]["duration"].as_str().and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
    let (width, height, fps) = match video {
        Some(vs) => (
            vs["width"].as_u64().unwrap_or(0) as u32,
            vs["height"].as_u64().unwrap_or(0) as u32,
            eval_rate(vs["avg_frame_rate"].as_str().unwrap_or("0/1")),
        ),
        None => (0, 0, 0.0),
    };
    let kind = if is_image_ext(&path) { "image" } else if video.is_some() { "video" } else if audio.is_some() { "audio" } else { "video" };

    Ok(MediaProbe { path, kind: kind.into(), duration, width, height, fps })
}

/* ------------------------------------------------------------------ */
/* Builders de argumentos FFmpeg por formato                          */
/* ------------------------------------------------------------------ */

/// MP4 — H.264 + AAC, normaliza resolução/fps, preenche silêncio onde não há áudio.
fn build_mp4_args(req: &ExportRequest) -> Vec<String> {
    let (w, h, fps) = (req.width, req.height, req.fps);
    let mut args: Vec<String> = Vec::new();

    for seg in &req.segments {
        args.extend(["-ss", &format!("{:.3}", seg.in_point), "-t", &format!("{:.3}", seg.duration), "-i", &seg.path].map(String::from));
    }

    let audio_flags: Vec<bool> = req.segments.iter().map(|s| has_audio(&s.path)).collect();
    let mut silence_for: Vec<Option<usize>> = vec![None; req.segments.len()];
    let mut next = req.segments.len();
    for (i, seg) in req.segments.iter().enumerate() {
        if !audio_flags[i] {
            args.extend(["-f","lavfi","-t",&format!("{:.3}", seg.duration),"-i","anullsrc=channel_layout=stereo:sample_rate=48000"].map(String::from));
            silence_for[i] = Some(next);
            next += 1;
        }
    }

    let mut filter = String::new();
    let mut labels = String::new();
    for (i, _) in req.segments.iter().enumerate() {
        filter.push_str(&format!(
            "[{i}:v]scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps={fps},format=yuv420p[v{i}];"
        ));
        let a = if audio_flags[i] { i } else { silence_for[i].unwrap() };
        filter.push_str(&format!("[{a}:a]aresample=async=1:first_pts=0,aformat=sample_rates=48000:channel_layouts=stereo[a{i}];"));
        labels.push_str(&format!("[v{i}][a{i}]"));
    }
    filter.push_str(&format!("{labels}concat=n={n}:v=1:a=1[outv][outa]", n = req.segments.len()));

    args.extend(["-filter_complex", &filter, "-map", "[outv]", "-map", "[outa]"].map(String::from));
    args.extend(["-r",&fps.to_string(),"-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-movflags","+faststart","-y",&req.output_path].map(String::from));
    args
}

/// MP3 — extrai e concatena o áudio dos segmentos (preenche silêncio onde não há).
fn build_mp3_args(req: &ExportRequest) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();

    for seg in &req.segments {
        args.extend(["-ss",&format!("{:.3}", seg.in_point),"-t",&format!("{:.3}", seg.duration),"-i",&seg.path].map(String::from));
    }

    let audio_flags: Vec<bool> = req.segments.iter().map(|s| has_audio(&s.path)).collect();
    let mut silence_for: Vec<Option<usize>> = vec![None; req.segments.len()];
    let mut next = req.segments.len();
    for (i, seg) in req.segments.iter().enumerate() {
        if !audio_flags[i] {
            args.extend(["-f","lavfi","-t",&format!("{:.3}", seg.duration),"-i","anullsrc=channel_layout=stereo:sample_rate=48000"].map(String::from));
            silence_for[i] = Some(next);
            next += 1;
        }
    }

    let mut filter = String::new();
    let mut labels = String::new();
    for (i, _) in req.segments.iter().enumerate() {
        let a = if audio_flags[i] { i } else { silence_for[i].unwrap() };
        filter.push_str(&format!("[{a}:a]aresample=async=1:first_pts=0,aformat=sample_rates=48000:channel_layouts=stereo[a{i}];"));
        labels.push_str(&format!("[a{i}]"));
    }
    filter.push_str(&format!("{labels}concat=n={n}:v=0:a=1[outa]", n = req.segments.len()));

    args.extend(["-filter_complex",&filter,"-map","[outa]","-c:a","libmp3lame","-q:a","2","-ar","48000","-ac","2","-y",&req.output_path].map(String::from));
    args
}

/// GIF animado — paleta otimizada em dois passes (split), escala máx 640px, 12 fps.
fn build_gif_args(req: &ExportRequest) -> Vec<String> {
    // Limita a largura (GIFs grandes ficam pesadíssimos) e a taxa de frames.
    let max_w: u32 = req.width.min(640);
    let gif_fps: f64 = req.fps.min(12.0).max(1.0);
    let mut args: Vec<String> = Vec::new();

    for seg in &req.segments {
        args.extend(["-ss",&format!("{:.3}", seg.in_point),"-t",&format!("{:.3}", seg.duration),"-i",&seg.path].map(String::from));
    }

    let mut filter = String::new();
    let mut labels = String::new();
    for (i, _) in req.segments.iter().enumerate() {
        filter.push_str(&format!("[{i}:v]scale={max_w}:-2:flags=lanczos,fps={gif_fps}[v{i}];"));
        labels.push_str(&format!("[v{i}]"));
    }
    filter.push_str(&format!("{labels}concat=n={n}:v=1:a=0[concat];", n = req.segments.len()));
    filter.push_str("[concat]split[s0][s1];[s0]palettegen=max_colors=256:reserve_transparent=0[pal];[s1][pal]paletteuse=dither=bayer[outgif]");

    args.extend(["-filter_complex",&filter,"-map","[outgif]","-y",&req.output_path].map(String::from));
    args
}

/* ------------------------------------------------------------------ */
/* parse_time — progresso a partir do stderr do ffmpeg                */
/* ------------------------------------------------------------------ */

fn parse_time(line: &str) -> Option<f64> {
    let idx = line.find("time=")?;
    let raw = line[idx + 5..].split_whitespace().next()?;
    let mut p = raw.split(':');
    let h: f64 = p.next()?.parse().ok()?;
    let m: f64 = p.next()?.parse().ok()?;
    let s: f64 = p.next()?.parse().ok()?;
    Some(h * 3600.0 + m * 60.0 + s)
}

/* ------------------------------------------------------------------ */
/* export_video                                                        */
/* ------------------------------------------------------------------ */

#[tauri::command]
pub async fn export_video(window: tauri::Window, request: ExportRequest) -> Result<String, String> {
    if request.segments.is_empty() {
        return Err("Nenhum clipe de vídeo na timeline para exportar.".into());
    }

    let total: f64 = request.segments.iter().map(|s| s.duration).sum();

    let args = match request.format.as_str() {
        "mp3" => build_mp3_args(&request),
        "gif" => build_gif_args(&request),
        _     => build_mp4_args(&request),   // "mp4" + fallback
    };

    let (mut rx, _child) = Command::new_sidecar("ffmpeg")
        .map_err(|e| format!("ffmpeg sidecar indisponível: {e}"))?
        .args(args)
        .spawn()
        .map_err(|e| format!("falha ao iniciar ffmpeg: {e}"))?;

    let mut err_tail = String::new();
    let mut ok = false;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(line) => {
                if let Some(t) = parse_time(&line) {
                    let progress = if total > 0.0 { (t / total).min(0.99) } else { 0.0 };
                    let _ = window.emit("export://progress", ExportProgress { progress, done: false, output: None });
                }
                err_tail.push_str(&line);
                err_tail.push('\n');
                if err_tail.len() > 4000 { err_tail = err_tail.split_off(err_tail.len() - 4000); }
            }
            CommandEvent::Terminated(payload) => { ok = payload.code == Some(0); }
            _ => {}
        }
    }

    if !ok {
        return Err(format!("ffmpeg falhou ({}):\n{err_tail}", request.format));
    }

    let _ = window.emit("export://progress", ExportProgress { progress: 1.0, done: true, output: Some(request.output_path.clone()) });
    Ok(request.output_path)
}
