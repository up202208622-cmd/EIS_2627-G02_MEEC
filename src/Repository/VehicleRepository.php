<?php
declare(strict_types=1);

namespace App\Repository;

// ===== Acesso às tabelas vehicles e vehicle_types (Miguel) =====
// Só SQL: as regras (quem aprova, validades, ...) estão no VehicleService.
// A capacidade (kg e m3) vem do tipo de veículo (vehicle_types), como no schema.sql.
// Os certificados são colunas de vehicles:
//   insurance_expiry_date / insurance_expiry_doc, inspection_expiry_date / inspection_expiry_doc
//   doc_updated_at + doc_checked = o estafeta enviou um certificado novo que o Staff ainda não viu (RF-37)
//
// Nota: o PDO está com prepared statements nativos (ATTR_EMULATE_PREPARES = false),
// por isso cada :marcador só pode aparecer uma vez em cada query.
final class VehicleRepository extends Repository
{
    public const DOC_TYPES = ['insurance', 'inspection'];

    private const SELECT = '
        SELECT v.id, v.courier_id, u.name AS courier_name, u.employee_number,
               v.vehicle_type_id, t.type_name, t.max_weight_kg, t.max_vol_m3,
               v.license_plate, v.model,
               v.insurance_expiry_date, v.inspection_expiry_date,
               v.insurance_expiry_doc, v.inspection_expiry_doc,
               v.approval_status, v.disapproval_reason, v.reviewed_by, v.reviewed_at,
               v.doc_updated_at, v.doc_checked, v.created_at
          FROM vehicles v
          JOIN users u ON u.id = v.courier_id
          JOIN vehicle_types t ON t.id = v.vehicle_type_id';

    public function types(): array
    {
        return $this->fetchAll('SELECT id, type_name, max_weight_kg, max_vol_m3 FROM vehicle_types ORDER BY max_weight_kg');
    }

    public function typeExists(int $typeId): bool
    {
        return $this->fetchValue('SELECT 1 FROM vehicle_types WHERE id = :id', ['id' => $typeId]) !== null;
    }

    public function plateExists(string $plate): bool
    {
        return $this->fetchValue('SELECT 1 FROM vehicles WHERE license_plate = :plate', ['plate' => $plate]) !== null;
    }

    public function find(int $id): ?array
    {
        return $this->fetchOne(self::SELECT . ' WHERE v.id = :id', ['id' => $id]);
    }

    public function listByCourier(int $courierId): array
    {
        return $this->fetchAll(self::SELECT . ' WHERE v.courier_id = :courier ORDER BY v.created_at DESC, v.id DESC',
            ['courier' => $courierId]);
    }

    /** @param string|null $status 'pending' | 'approved' | 'disapproved' | null = todos */
    public function listByStatus(?string $status): array
    {
        if ($status === null) {
            return $this->fetchAll(self::SELECT . ' ORDER BY v.created_at DESC, v.id DESC');
        }
        return $this->fetchAll(self::SELECT . ' WHERE v.approval_status = :status ORDER BY v.created_at DESC, v.id DESC',
            ['status' => $status]);
    }

    public function countByStatus(string $status): int
    {
        return (int) $this->fetchValue('SELECT COUNT(*) FROM vehicles WHERE approval_status = :status', ['status' => $status]);
    }

    /** Veículos aprovados com um certificado novo que o Staff ainda não viu. */
    public function countUnchecked(): int
    {
        return (int) $this->fetchValue(
            "SELECT COUNT(*) FROM vehicles WHERE approval_status = 'approved' AND doc_checked = 0");
    }

    /** O registo do estafeta: fica 'pending' até o Staff decidir. */
    public function create(array $v): int
    {
        return $this->insert(
            'INSERT INTO vehicles (courier_id, vehicle_type_id, license_plate, model,
                                   insurance_expiry_date, inspection_expiry_date,
                                   insurance_expiry_doc, inspection_expiry_doc,
                                   approval_status, doc_updated_at, doc_checked, created_at)
             VALUES (:courier_id, :vehicle_type_id, :license_plate, :model,
                     :insurance_date, :inspection_date, :insurance_doc, :inspection_doc,
                     \'pending\', :doc_updated_at, 0, :created_at)',
            [
                'courier_id' => $v['courier_id'],
                'vehicle_type_id' => $v['vehicle_type_id'],
                'license_plate' => $v['license_plate'],
                'model' => $v['model'],
                'insurance_date' => $v['insurance_expiry_date'],
                'inspection_date' => $v['inspection_expiry_date'],
                'insurance_doc' => $v['insurance_expiry_doc'],
                'inspection_doc' => $v['inspection_expiry_doc'],
                'doc_updated_at' => $v['created_at'],
                'created_at' => $v['created_at'],
            ]
        );
    }

    /**
     * Certificado novo enviado pelo estafeta (RF-35).
     * - veículo aprovado: continua aprovado, mas doc_checked = 0 (o Staff tem de o ver, RF-37)
     * - veículo recusado: volta a 'pending' (o Staff decide outra vez)
     * O nome da coluna vem de DOC_TYPES (lista fixa), nunca do utilizador.
     */
    public function updateDocument(int $id, string $docType, string $expiryDate, string $docPath, string $now): void
    {
        if (!in_array($docType, self::DOC_TYPES, true)) {
            throw new \InvalidArgumentException('Unknown document type.');
        }
        $this->execute(
            "UPDATE vehicles
                SET {$docType}_expiry_date = :expiry, {$docType}_expiry_doc = :doc,
                    doc_updated_at = :now, doc_checked = 0,
                    disapproval_reason = CASE WHEN approval_status = 'disapproved' THEN NULL ELSE disapproval_reason END,
                    approval_status = CASE WHEN approval_status = 'disapproved' THEN 'pending' ELSE approval_status END
              WHERE id = :id",
            ['expiry' => $expiryDate, 'doc' => $docPath, 'now' => $now, 'id' => $id]
        );
    }

    /** Aprova só se ainda estiver 'pending' (false = outro membro do Staff já decidiu). */
    public function approve(int $id, int $reviewerId, string $now): bool
    {
        return $this->execute(
            "UPDATE vehicles
                SET approval_status = 'approved', disapproval_reason = NULL,
                    reviewed_by = :reviewer, reviewed_at = :now, doc_checked = 1
              WHERE id = :id AND approval_status = 'pending'",
            ['reviewer' => $reviewerId, 'now' => $now, 'id' => $id]
        ) === 1;
    }

    /** Recusa um veículo pendente ou tira de serviço um aprovado (RF-27, RF-38). */
    public function disapprove(int $id, string $reason, int $reviewerId, string $now): bool
    {
        return $this->execute(
            "UPDATE vehicles
                SET approval_status = 'disapproved', disapproval_reason = :reason,
                    reviewed_by = :reviewer, reviewed_at = :now
              WHERE id = :id AND approval_status IN ('pending', 'approved')",
            ['reason' => $reason, 'reviewer' => $reviewerId, 'now' => $now, 'id' => $id]
        ) === 1;
    }

    /** O Staff viu o certificado novo (RF-37). */
    public function markChecked(int $id): bool
    {
        return $this->execute(
            "UPDATE vehicles SET doc_checked = 1 WHERE id = :id AND approval_status = 'approved' AND doc_checked = 0",
            ['id' => $id]
        ) === 1;
    }
}
