import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count >= 2 else {
    fputs("Usage: vision-ocr.swift image [output]\n", stderr)
    exit(2)
}

let imagePath = CommandLine.arguments[1]
let outputPath = CommandLine.arguments.count >= 3 ? CommandLine.arguments[2] : nil

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["zh-Hans", "en-US"]
request.minimumTextHeight = 0.006
request.usesCPUOnly = true

let handler = VNImageRequestHandler(url: URL(fileURLWithPath: imagePath), options: [:])

do {
    try handler.perform([request])
} catch {
    fputs("OCR failed: \(error)\n", stderr)
    exit(5)
}

let observations = (request.results ?? []).sorted {
    let yDifference = $0.boundingBox.midY - $1.boundingBox.midY
    if abs(yDifference) > 0.008 {
        return yDifference > 0
    }
    return $0.boundingBox.minX < $1.boundingBox.minX
}

let text = observations.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")

if let outputPath {
    do {
        try text.write(toFile: outputPath, atomically: true, encoding: .utf8)
    } catch {
        fputs("Cannot write output: \(error)\n", stderr)
        exit(6)
    }
} else {
    print(text)
}
