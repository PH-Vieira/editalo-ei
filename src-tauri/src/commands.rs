//! Comandos Tauri — FFmpeg/FFprobe como sidecars.
//! Suporta exportação em MP4 (H.264+AAC), MP3 (áudio) e GIF animado.

use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::Path;
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
        let stderr = output.stderr.trim();
        let stdout = output.stdout.trim();
        let detail = if !stderr.is_empty() {
            stderr.to_string()
        } else if !stdout.is_empty() {
            stdout.to_string()
        } else {
            format!("código {}", output.status.code().unwrap_or(-1))
        };
        return Err(format!("ffprobe falhou: {detail}"));
    }
    Ok(output.stdout)
}

/// ffprobe com `-i` explícito; GIFs tentam de novo com `-f gif`.
fn run_ffprobe_media(path: &str) -> Result<String, String> {
    let base = [
        "-v",
        "error",
        "-probesize",
        "50000000",
        "-analyzeduration",
        "50000000",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        "-i",
        path,
    ];
    match run_ffprobe(&base) {
        Ok(json) => Ok(json),
        Err(primary) if is_gif_path(path) => {
            let gif_args = [
                "-v",
                "error",
                "-probesize",
                "50000000",
                "-analyzeduration",
                "50000000",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                "-f",
                "gif",
                "-i",
                path,
            ];
            run_ffprobe(&gif_args).map_err(|fallback| format!("{primary}; gif: {fallback}"))
        }
        Err(err) => Err(err),
    }
}

fn parse_probe_json(path: &str, json: &str) -> Result<MediaProbe, String> {
    let v: serde_json::Value =
        serde_json::from_str(json).map_err(|e| format!("JSON inválido: {e}"))?;

    let streams = v["streams"].as_array().cloned().unwrap_or_default();
    let video = streams.iter().find(|s| s["codec_type"] == "video");
    let audio = streams.iter().find(|s| s["codec_type"] == "audio");

    let duration = v["format"]["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);
    let (width, height, fps) = match video {
        Some(vs) => (
            vs["width"].as_u64().unwrap_or(0) as u32,
            vs["height"].as_u64().unwrap_or(0) as u32,
            eval_rate(vs["avg_frame_rate"].as_str().unwrap_or("0/1")),
        ),
        None => (0, 0, 0.0),
    };
    let kind = if is_image_ext(path) && !path.to_lowercase().ends_with(".gif") {
        "image"
    } else if video.is_some() {
        "video"
    } else if audio.is_some() {
        "audio"
    } else if is_image_ext(path) {
        "image"
    } else {
        "video"
    };

    Ok(MediaProbe {
        path: path.into(),
        kind: kind.into(),
        duration,
        width,
        height,
        fps,
    })
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

fn is_gif_path(path: &str) -> bool {
    path.to_lowercase().ends_with(".gif")
}

/// Versão da receita de conversão — incrementar invalida caches antigos.
const GIF_PROXY_RECIPE: u64 = 2;

fn import_cache_key(path: &str) -> Result<u64, String> {
    let meta = std::fs::metadata(path).map_err(|e| format!("metadata: {e}"))?;
    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let mut h = DefaultHasher::new();
    path.hash(&mut h);
    modified.hash(&mut h);
    meta.len().hash(&mut h);
    GIF_PROXY_RECIPE.hash(&mut h);
    Ok(h.finish())
}

/// Metadados básicos de um GIF para decidir se converte e por quanto tempo.
struct GifProbe {
    animated: bool,
}

fn probe_gif(path: &str) -> Result<GifProbe, String> {
    let json = run_ffprobe_media(path)?;
    let v: serde_json::Value =
        serde_json::from_str(&json).map_err(|e| format!("JSON inválido: {e}"))?;

    let duration = v["format"]["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    let mut animated = duration > 0.1;

    if let Some(streams) = v["streams"].as_array() {
        if let Some(vs) = streams.iter().find(|s| s["codec_type"] == "video") {
            if let Some(n) = vs["nb_frames"].as_str().and_then(|s| s.parse::<u64>().ok()) {
                animated = n > 1;
            }
            if duration <= 0.0 {
                if let Some(d) = vs["duration"].as_str().and_then(|s| s.parse::<f64>().ok()) {
                    if d > 0.1 {
                        animated = true;
                    }
                }
            }
        }
    }

    Ok(GifProbe { animated })
}

fn cache_file_valid(path: &Path) -> bool {
    path.is_file() && path.metadata().map(|m| m.len() > 512).unwrap_or(false)
}

/// MP4 em cache precisa ser legível pelo ffprobe (evita "moov atom not found").
fn mp4_cache_valid(path: &Path) -> bool {
    if !cache_file_valid(path) {
        return false;
    }
    let path_str = path.to_string_lossy();
    run_ffprobe_media(path_str.as_ref()).is_ok()
}

fn convert_gif_to_mp4(source: &str, dest: &Path) -> Result<(), String> {
    if dest.is_file() {
        let _ = std::fs::remove_file(dest);
    }
    let dest_str = dest.to_string_lossy();

    // Passagem 1 — escala par + H.264 (sem -t nem faststart: mais confiável no Windows).
    let primary = run_ffmpeg_sync(&[
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ignore_loop",
        "1",
        "-i",
        source,
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,format=yuv420p",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-an",
        &dest_str,
    ]);

    if primary.is_ok() && mp4_cache_valid(dest) {
        return Ok(());
    }

    let _ = std::fs::remove_file(dest);

    // Passagem 2 — receita mínima caso a primeira falhe ou gere arquivo inválido.
    run_ffmpeg_sync(&[
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ignore_loop",
        "1",
        "-i",
        source,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        "-an",
        &dest_str,
    ])
}

fn ensure_gif_proxy(source: &str, out: &Path) -> Result<(), String> {
    if mp4_cache_valid(out) {
        return Ok(());
    }
    if out.is_file() {
        let _ = std::fs::remove_file(out);
    }
    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("cache: {e}"))?;
    }
    convert_gif_to_mp4(source, out)?;
    if !mp4_cache_valid(out) {
        let _ = std::fs::remove_file(out);
        return Err(
            "ffmpeg gerou um MP4 inválido para o GIF (moov atom ausente). \
             Tente remover o cache em %LOCALAPPDATA%/*/cache/gif_proxy e importar de novo."
                .into(),
        );
    }
    Ok(())
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
    let json = run_ffprobe_media(&path)?;
    parse_probe_json(&path, &json)
}

#[tauri::command]
pub async fn prepare_import_media(path: String) -> Result<MediaProbe, String> {
    if !Path::new(&path).is_file() {
        return Err(format!("arquivo não encontrado: {path}"));
    }

    if is_gif_path(&path) {
        let gif_meta = probe_gif(&path).ok();
        // Se o ffprobe falhar, ainda tentamos converter — o ffmpeg lê GIF diretamente.
        let should_convert = gif_meta.as_ref().map(|g| g.animated).unwrap_or(true);

        if should_convert {
            let cache_root = tauri::api::path::cache_dir().ok_or("pasta de cache indisponível")?;
            let key = import_cache_key(&path)?;
            let out = cache_root.join("gif_proxy").join(format!("{:016x}.mp4", key));

            ensure_gif_proxy(&path, &out)?;

            let out_path = out.to_string_lossy().into_owned();
            return probe_media(out_path).await;
        }
    }

    probe_media(path).await
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

/* ------------------------------------------------------------------ */
/* Miniaturas da timeline (filmstrip)                                  */
/* ------------------------------------------------------------------ */

#[derive(Debug, Deserialize)]
pub struct ThumbnailRequest {
    pub path: String,
    #[serde(rename = "inPoint")]
    pub in_point: f64,
    pub duration: f64,
    pub count: u32,
    pub width: u32,
}

fn thumb_cache_key(path: &str, in_point: f64, duration: f64, count: u32, width: u32) -> u64 {
    let mut h = DefaultHasher::new();
    path.hash(&mut h);
    in_point.to_bits().hash(&mut h);
    duration.to_bits().hash(&mut h);
    count.hash(&mut h);
    width.hash(&mut h);
    h.finish()
}

fn run_ffmpeg_sync(args: &[&str]) -> Result<(), String> {
    let output = Command::new_sidecar("ffmpeg")
        .map_err(|e| format!("ffmpeg sidecar indisponível: {e}"))?
        .args(args)
        .output()
        .map_err(|e| format!("falha ao executar ffmpeg: {e}"))?;
    if !output.status.success() {
        let stderr = output.stderr.trim();
        let detail = if stderr.is_empty() {
            format!("código {}", output.status.code().unwrap_or(-1))
        } else {
            stderr.to_string()
        };
        return Err(format!("ffmpeg falhou: {detail}"));
    }
    Ok(())
}

fn collect_cached_thumbs(dir: &Path, count: u32) -> Option<Vec<String>> {
    let paths: Vec<String> = (0..count)
        .filter_map(|i| {
            let p = dir.join(format!("thumb_{:03}.jpg", i + 1));
            if p.is_file() {
                Some(p.to_string_lossy().into_owned())
            } else {
                None
            }
        })
        .collect();
    if paths.len() == count as usize {
        Some(paths)
    } else {
        None
    }
}

/// Extrai N frames JPEG do trecho [inPoint, inPoint+duration] para a filmstrip do clipe.
#[tauri::command]
pub fn extract_thumbnails(request: ThumbnailRequest) -> Result<Vec<String>, String> {
    let count = request.count.clamp(1, 16);
    let width = request.width.clamp(48, 320);
    let duration = request.duration.max(0.05);
    let in_point = request.in_point.max(0.0);

    if !Path::new(&request.path).is_file() {
        return Err(format!("arquivo não encontrado: {}", request.path));
    }

    let cache_root = tauri::api::path::cache_dir().ok_or("pasta de cache indisponível")?;
    let key = thumb_cache_key(&request.path, in_point, duration, count, width);
    let dir = cache_root.join("filmstrip").join(format!("{:016x}", key));
    std::fs::create_dir_all(&dir).map_err(|e| format!("cache: {e}"))?;

    if let Some(paths) = collect_cached_thumbs(&dir, count) {
        return Ok(paths);
    }

    // Limpa saídas parciais de execuções anteriores.
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let _ = std::fs::remove_file(entry.path());
        }
    }

    let scale_vf = format!("scale={width}:-2:flags=fast_bilinear");

    if is_image_ext(&request.path) {
        let out = dir.join("thumb_001.jpg");
        let out_str = out.to_string_lossy();
        run_ffmpeg_sync(&[
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            &request.path,
            "-vf",
            &scale_vf,
            "-frames:v",
            "1",
            "-q:v",
            "4",
            &out_str,
        ])?;
        let mut paths = Vec::with_capacity(count as usize);
        let path = out.to_string_lossy().into_owned();
        for _ in 0..count {
            paths.push(path.clone());
        }
        return Ok(paths);
    }

    // Um frame por instante — mais confiável que fps=count/duration no Windows.
    let step = duration / f64::from(count);
    for i in 0..count {
        let t = in_point + (f64::from(i) + 0.5) * step;
        let out = dir.join(format!("thumb_{:03}.jpg", i + 1));
        let t_s = format!("{t:.3}");
        let out_s = out.to_string_lossy();
        run_ffmpeg_sync(&[
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-ss",
            &t_s,
            "-i",
            &request.path,
            "-vframes",
            "1",
            "-vf",
            &scale_vf,
            "-q:v",
            "4",
            &out_s,
        ])?;
    }

    collect_cached_thumbs(&dir, count).ok_or_else(|| "ffmpeg não gerou as miniaturas esperadas".into())
}

/* ------------------------------------------------------------------ */
/* Forma de onda (áudio)                                               */
/* ------------------------------------------------------------------ */

#[derive(Debug, Deserialize)]
pub struct WaveformRequest {
    pub path: String,
    #[serde(rename = "inPoint")]
    pub in_point: f64,
    pub duration: f64,
    pub bins: u32,
}

fn waveform_cache_key(path: &str, in_point: f64, duration: f64, bins: u32) -> u64 {
    let mut h = DefaultHasher::new();
    path.hash(&mut h);
    in_point.to_bits().hash(&mut h);
    duration.to_bits().hash(&mut h);
    bins.hash(&mut h);
    h.finish()
}

fn bucket_peaks(samples: &[f32], bins: u32) -> Vec<f32> {
    let bins = bins.max(1) as usize;
    if samples.is_empty() {
        return vec![0.12; bins];
    }
    let per = (samples.len() as f64 / bins as f64).max(1.0);
    let mut peaks = Vec::with_capacity(bins);
    let mut max_global = 0.0001f32;
    for b in 0..bins {
        let start = (b as f64 * per) as usize;
        let end = ((b as f64 + 1.0) * per) as usize;
        let end = end.min(samples.len()).max(start + 1);
        let peak = samples[start..end]
            .iter()
            .map(|s| s.abs())
            .fold(0.0f32, f32::max);
        peaks.push(peak);
        max_global = max_global.max(peak);
    }
    peaks
        .into_iter()
        .map(|p| (p / max_global).clamp(0.08, 1.0))
        .collect()
}

/// Picos normalizados (0–1) do áudio no trecho visível do clipe.
#[tauri::command]
pub fn extract_waveform(request: WaveformRequest) -> Result<Vec<f32>, String> {
    let bins = request.bins.clamp(48, 512);
    let duration = request.duration.max(0.05);
    let in_point = request.in_point.max(0.0);

    if !Path::new(&request.path).is_file() {
        return Err(format!("arquivo não encontrado: {}", request.path));
    }

    let cache_root = tauri::api::path::cache_dir().ok_or("pasta de cache indisponível")?;
    let key = waveform_cache_key(&request.path, in_point, duration, bins);
    let dir = cache_root.join("waveform").join(format!("{:016x}", key));
    std::fs::create_dir_all(&dir).map_err(|e| format!("cache: {e}"))?;

    let peaks_file = dir.join("peaks.json");
    if peaks_file.is_file() {
        let raw = std::fs::read_to_string(&peaks_file).map_err(|e| e.to_string())?;
        if let Ok(peaks) = serde_json::from_str::<Vec<f32>>(&raw) {
            if peaks.len() == bins as usize {
                return Ok(peaks);
            }
        }
    }

    let raw_path = dir.join("audio.f32le");
    let raw_str = raw_path.to_string_lossy();
    let in_s = format!("{in_point:.3}");
    let dur_s = format!("{duration:.3}");

    // Vídeo: extrai faixa de áudio; arquivo só-áudio: mesmo comando.
    if run_ffmpeg_sync(&[
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        &in_s,
        "-i",
        &request.path,
        "-t",
        &dur_s,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "8000",
        "-f",
        "f32le",
        &raw_str,
    ])
    .is_err()
    {
        return Ok(vec![0.12; bins as usize]);
    }

    let bytes = std::fs::read(&raw_path).unwrap_or_default();
    let samples: Vec<f32> = bytes
        .chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect();

    let peaks = bucket_peaks(&samples, bins);
    let json = serde_json::to_string(&peaks).map_err(|e| e.to_string())?;
    let _ = std::fs::write(&peaks_file, json);
    let _ = std::fs::remove_file(&raw_path);
    Ok(peaks)
}

/* ------------------------------------------------------------------ */
/* Persistência de projeto (.regua)                                     */
/* ------------------------------------------------------------------ */

#[tauri::command]
pub fn save_project_file(path: String, content: String) -> Result<(), String> {
    let path_ref = std::path::Path::new(&path);
    if let Some(parent) = path_ref.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| format!("não foi possível criar a pasta: {e}"))?;
        }
    }
    std::fs::write(path_ref, content).map_err(|e| format!("não foi possível gravar o arquivo: {e}"))
}

#[tauri::command]
pub fn load_project_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("não foi possível ler o arquivo: {e}"))
}
