<?php
declare(strict_types=1);

namespace App\Service;

// ===== Ficheiros dos certificados (seguro e inspeção) =====
// Ficam em uploads/docs/ com um nome aleatório (nunca o nome que vem do utilizador).
// O uploads/.htaccess impede o Apache de os servir diretamente: só se descarregam pela API
// (GET /api/vehicles/{id}/documents/{type}), que verifica quem pede.
// Na base de dados fica o caminho relativo, ex. 'uploads/docs/3f9a...c1.pdf' (como no schema.sql).
final class DocumentStorage
{
    public const MAX_BYTES = 5 * 1024 * 1024;
    public const FOLDER = 'uploads/docs';

    // Tipos aceites, verificados pelo conteúdo do ficheiro (finfo) e não pela extensão
    private const ALLOWED = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
    ];

    /**
     * @param string $projectRoot pasta raiz do repositório (onde está a pasta uploads)
     * @param bool   $allowLocal  só nos testes: aceita ficheiros que não vieram de um upload HTTP
     */
    public function __construct(private ?string $projectRoot = null, private bool $allowLocal = false)
    {
        $this->projectRoot ??= dirname(__DIR__, 2);
    }

    /** '' se o ficheiro está bem, ou a mensagem de erro para o campo. */
    public function validate(?array $file): string
    {
        $error = $file['error'] ?? UPLOAD_ERR_NO_FILE;
        if ($file === null || $error === UPLOAD_ERR_NO_FILE) {
            return 'Please attach the certificate.';
        }
        if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE || ($file['size'] ?? 0) > self::MAX_BYTES) {
            return 'The file is larger than 5 MB.';
        }
        if ($error !== UPLOAD_ERR_OK) {
            return 'The upload failed. Please try again.';
        }
        if (!isset(self::ALLOWED[$this->mimeOf((string) $file['tmp_name'])])) {
            return 'Use a PDF, JPG or PNG file.';
        }
        return '';
    }

    /** Guarda o ficheiro (já validado) e devolve o caminho relativo para a base de dados. */
    public function store(array $file): string
    {
        $extension = self::ALLOWED[$this->mimeOf((string) $file['tmp_name'])];
        $relative = self::FOLDER . '/' . bin2hex(random_bytes(16)) . '.' . $extension;
        $target = $this->projectRoot . '/' . $relative;

        if (!is_dir(dirname($target)) && !mkdir(dirname($target), 0775, true)) {
            throw new \RuntimeException('Cannot create the uploads/docs folder.');
        }
        $ok = is_uploaded_file($file['tmp_name'])
            ? move_uploaded_file($file['tmp_name'], $target)
            : ($this->allowLocal && copy($file['tmp_name'], $target));
        if (!$ok) {
            throw new \RuntimeException('Could not save the uploaded file.');
        }
        return $relative;
    }

    public function delete(string $relative): void
    {
        $path = $this->absolutePath($relative);
        if ($path !== null && is_file($path)) {
            unlink($path);
        }
    }

    /** Caminho no disco, só se o ficheiro estiver mesmo dentro de uploads/docs (nada de "../"). */
    public function absolutePath(?string $relative): ?string
    {
        if ($relative === null || !str_starts_with($relative, self::FOLDER . '/') || str_contains($relative, '..')) {
            return null;
        }
        return $this->projectRoot . '/' . $relative;
    }

    public function mimeOf(string $path): string
    {
        return is_file($path) ? (string) (new \finfo(FILEINFO_MIME_TYPE))->file($path) : '';
    }
}
