-- =====================================================================
--  CourierCMS - Sprint 2  |  Grupo G02 MEEC  |  EIS_2627-G02_MEEC
--  Esquema fisico MySQL/MariaDB (XAMPP) + dados de teste
--
--  Como usar: phpMyAdmin > Importar > escolher este ficheiro.
--  (cria a base de dados `couriercms`; volta a correr = recomeca do zero)
--
--  Nomes: as entidades do ER (User, Order, ...) sao tabelas no plural
--  (users, orders, ...) porque `order` e palavra reservada em SQL.
--
--  Contas de demonstracao (password -> hash bcrypt gerado com password_hash):
--    client@demo.com   Client123      courier@demo.com  Courier123
--    staff@demo.com    Staff1234      admin@demo.com    Admin1234
--    restantes contas de teste: Demo1234
-- =====================================================================

DROP DATABASE IF EXISTS couriercms;
CREATE DATABASE couriercms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE couriercms;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- Utilizadores (cliente, estafeta, staff, admin)
-- courier: last_lat/last_long = local da ultima entrega (WP3)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username        VARCHAR(30)  NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  email           VARCHAR(120) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  phone           VARCHAR(20)  NULL,
  nif             CHAR(9)      NULL,
  employee_number VARCHAR(20)  NULL,
  role            ENUM('client','courier','staff','admin') NOT NULL,
  status          ENUM('pending','active','rejected') NOT NULL DEFAULT 'active',
  last_lat        DECIMAL(9,6) NULL,
  last_long       DECIMAL(9,6) NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_nif (nif),
  UNIQUE KEY uq_users_employee (employee_number),
  KEY ix_users_role_status (role, status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Tipos de veiculo: a capacidade (kg e m3) vem daqui (WP2)
-- ---------------------------------------------------------------------
CREATE TABLE vehicle_types (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  type_name     VARCHAR(30)  NOT NULL,
  max_weight_kg DECIMAL(8,2) NOT NULL,
  max_vol_m3    DECIMAL(8,3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicle_types_name (type_name),
  CONSTRAINT ck_vt_pos CHECK (max_weight_kg > 0 AND max_vol_m3 > 0)
) ENGINE=InnoDB;

CREATE TABLE vehicles (
  id                     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  courier_id             INT UNSIGNED NOT NULL,
  vehicle_type_id        INT UNSIGNED NOT NULL,
  license_plate          VARCHAR(12)  NOT NULL,
  model                  VARCHAR(60)  NOT NULL,
  insurance_expiry_date  DATE         NOT NULL,
  inspection_expiry_date DATE         NOT NULL,
  insurance_expiry_doc   VARCHAR(255) NULL,
  inspection_expiry_doc  VARCHAR(255) NULL,
  approval_status        ENUM('pending','approved','disapproved') NOT NULL DEFAULT 'pending',
  disapproval_reason     VARCHAR(255) NULL,
  reviewed_by            INT UNSIGNED NULL,
  reviewed_at            DATETIME     NULL,
  doc_updated_at         DATETIME     NULL,
  doc_checked            TINYINT(1)   NOT NULL DEFAULT 0,
  created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicles_plate (license_plate),
  KEY ix_vehicles_courier (courier_id),
  KEY ix_vehicles_type (vehicle_type_id),
  CONSTRAINT fk_vehicles_courier  FOREIGN KEY (courier_id)      REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_vehicles_type     FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types (id),
  CONSTRAINT fk_vehicles_reviewer FOREIGN KEY (reviewed_by)     REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Produtos do cliente
-- ---------------------------------------------------------------------
CREATE TABLE products (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id   INT UNSIGNED NOT NULL,
  description VARCHAR(120) NOT NULL,
  category    VARCHAR(40)  NOT NULL,
  weight_kg   DECIMAL(8,2) NOT NULL,
  volume_m3   DECIMAL(8,3) NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_products_client (client_id),
  CONSTRAINT fk_products_client FOREIGN KEY (client_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT ck_products_pos CHECK (weight_kg > 0 AND volume_m3 > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Rotas (WP2): 1 rota -> N encomendas (orders.route_id)
-- ---------------------------------------------------------------------
CREATE TABLE routes (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  courier_id      INT UNSIGNED NOT NULL,
  vehicle_id      INT UNSIGNED NOT NULL,
  status          ENUM('planned','in_progress','completed') NOT NULL DEFAULT 'planned',
  total_weight_kg DECIMAL(9,2) NOT NULL DEFAULT 0,
  total_vol_m3    DECIMAL(9,3) NOT NULL DEFAULT 0,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at      DATETIME     NULL,
  completed_at    DATETIME     NULL,
  PRIMARY KEY (id),
  KEY ix_routes_courier (courier_id),
  KEY ix_routes_vehicle (vehicle_id),
  KEY ix_routes_created (created_at),
  CONSTRAINT fk_routes_courier FOREIGN KEY (courier_id) REFERENCES users (id),
  CONSTRAINT fk_routes_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Encomendas
-- status: Pending -> Initiated -> In Progress -> Completed | Cancelled | RTO
-- Uma encomenda so e visivel aos estafetas depois de ter um pagamento
-- 'paid' do tipo 'order' (WP1).
-- ---------------------------------------------------------------------
CREATE TABLE orders (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id           INT UNSIGNED NOT NULL,
  courier_id          INT UNSIGNED NULL,
  route_id            INT UNSIGNED NULL,
  route_sequence      SMALLINT UNSIGNED NULL,
  origin_lat          DECIMAL(9,6) NOT NULL,
  origin_long         DECIMAL(9,6) NOT NULL,
  dest_lat            DECIMAL(9,6) NOT NULL,
  dest_long           DECIMAL(9,6) NOT NULL,
  distance_km         DECIMAL(7,2) NOT NULL,
  declared_weight_kg  DECIMAL(9,2) NOT NULL,
  declared_vol_m3     DECIMAL(9,3) NOT NULL,
  actual_weight_kg    DECIMAL(9,2) NULL,
  price_total         DECIMAL(9,2) NOT NULL,
  status              ENUM('Pending','Initiated','In Progress','Completed','Cancelled','RTO') NOT NULL DEFAULT 'Pending',
  attempt             TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at        DATETIME     NULL,
  PRIMARY KEY (id),
  KEY ix_orders_client (client_id),
  KEY ix_orders_courier (courier_id),
  KEY ix_orders_route (route_id),
  KEY ix_orders_status (status),
  KEY ix_orders_created (created_at),
  CONSTRAINT fk_orders_client  FOREIGN KEY (client_id)  REFERENCES users (id),
  CONSTRAINT fk_orders_courier FOREIGN KEY (courier_id) REFERENCES users (id),
  CONSTRAINT fk_orders_route   FOREIGN KEY (route_id)   REFERENCES routes (id) ON DELETE SET NULL,
  CONSTRAINT ck_orders_price   CHECK (price_total >= 0)
) ENGINE=InnoDB;

CREATE TABLE order_products (
  order_id   INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity   SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (order_id, product_id),
  KEY ix_op_product (product_id),
  CONSTRAINT fk_op_order   FOREIGN KEY (order_id)   REFERENCES orders (id)   ON DELETE CASCADE,
  CONSTRAINT fk_op_product FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT ck_op_qty     CHECK (quantity > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Pagamentos MockGateway (WP1) e taxa extra de RTO (WP4)
-- ---------------------------------------------------------------------
CREATE TABLE payments (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id    INT UNSIGNED NOT NULL,
  kind        ENUM('order','rto_fee') NOT NULL DEFAULT 'order',
  amount      DECIMAL(9,2) NOT NULL,
  gateway_ref VARCHAR(60)  NULL,
  status      ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at     DATETIME     NULL,
  PRIMARY KEY (id),
  KEY ix_payments_order (order_id),
  KEY ix_payments_paid (status, paid_at),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT ck_payments_amount CHECK (amount > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Fila de despacho (WP3): propostas com janela de resposta (ex.: 60 s)
-- ---------------------------------------------------------------------
CREATE TABLE dispatch_offers (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id    INT UNSIGNED NOT NULL,
  courier_id  INT UNSIGNED NOT NULL,
  distance_km DECIMAL(7,2) NULL,
  offered_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME     NOT NULL,
  status      ENUM('offered','accepted','declined','expired') NOT NULL DEFAULT 'offered',
  PRIMARY KEY (id),
  KEY ix_offers_order (order_id),
  KEY ix_offers_courier_status (courier_id, status),
  CONSTRAINT fk_offers_order   FOREIGN KEY (order_id)   REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_offers_courier FOREIGN KEY (courier_id) REFERENCES users (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Codigo de entrega (WP5): gerado quando o estafeta aceita a encomenda
-- ---------------------------------------------------------------------
CREATE TABLE delivery_codes (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id     INT UNSIGNED NOT NULL,
  code         VARCHAR(12)  NOT NULL,
  generated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at      DATETIME     NULL,
  failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,  -- codigos errados no e-POD (bloqueia aos 5)
  PRIMARY KEY (id),
  UNIQUE KEY uq_codes_order (order_id),
  UNIQUE KEY uq_codes_code (code),
  CONSTRAINT fk_codes_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE proofs_of_delivery (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id     INT UNSIGNED NOT NULL,
  type         ENUM('photo','signature') NOT NULL,
  file         VARCHAR(255) NOT NULL,
  delivered_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pod_order (order_id),
  CONSTRAINT fk_pod_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Tarifas editaveis pelo admin: a mais recente (maior id) e a ativa
-- Preco = base_fee + km * rate_km + MAX(peso real, volume * volumetric_factor) * rate_kg
-- ---------------------------------------------------------------------
CREATE TABLE pricing_rates (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  base_fee          DECIMAL(7,2) NOT NULL,
  rate_km           DECIMAL(7,2) NOT NULL,
  rate_kg           DECIMAL(7,2) NOT NULL,
  volumetric_factor SMALLINT UNSIGNED NOT NULL DEFAULT 200,
  updated_by        INT UNSIGNED NULL,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_rates_user FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT ck_rates_pos CHECK (base_fee >= 0 AND rate_km >= 0 AND rate_kg >= 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Repesagem / RTO (WP4)
-- ---------------------------------------------------------------------
CREATE TABLE reweigh_events (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id           INT UNSIGNED NOT NULL,
  declared_weight_kg DECIMAL(9,2) NOT NULL,
  actual_weight_kg   DECIMAL(9,2) NOT NULL,
  extra_fee          DECIMAL(9,2) NOT NULL,
  return_fee         DECIMAL(9,2) NOT NULL,
  status             ENUM('awaiting_payment','paid','returned') NOT NULL DEFAULT 'awaiting_payment',
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at        DATETIME     NULL,
  PRIMARY KEY (id),
  KEY ix_reweigh_order (order_id),
  CONSTRAINT fk_reweigh_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- Vistas para o dashboard e para as estatisticas publicas
-- ---------------------------------------------------------------------
CREATE VIEW v_orders_by_status AS
  SELECT status, COUNT(*) AS total FROM orders GROUP BY status;

CREATE VIEW v_vehicles_by_type AS
  SELECT vt.type_name, COUNT(v.id) AS total
  FROM vehicle_types vt LEFT JOIN vehicles v ON v.vehicle_type_id = vt.id
  GROUP BY vt.id, vt.type_name;

CREATE VIEW v_couriers_by_type AS
  SELECT vt.type_name, COUNT(DISTINCT v.courier_id) AS total
  FROM vehicle_types vt
  LEFT JOIN vehicles v ON v.vehicle_type_id = vt.id AND v.approval_status = 'approved'
  GROUP BY vt.id, vt.type_name;

CREATE VIEW v_monthly_gains AS
  SELECT DATE_FORMAT(paid_at, '%Y-%m') AS month, SUM(amount) AS gains
  FROM payments WHERE status = 'paid' GROUP BY DATE_FORMAT(paid_at, '%Y-%m');

-- =====================================================================
--  DADOS DE TESTE
-- =====================================================================

-- users
INSERT INTO users (id, username, password_hash, email, name, phone, nif, employee_number, role, status, last_lat, last_long, created_at) VALUES
  (1, 'acosta', '$2y$10$XZuv2E1Xa9/osFsLzm58n.XEr//8d67kVAsSpFgzEnHJf1tGqlAlu', 'client@demo.com', 'Ana Costa', '912345678', '123456789', NULL, 'client', 'active', NULL, NULL, '2026-10-01 10:00:00'),
  (2, 'rmartins', '$2y$10$tdwmgUExvt/Yvyfes9l/juMQCdvaD2JHJu.n7ZOmEUnEHt/WvJGj6', 'courier@demo.com', 'Rui Martins', '918765432', '234567813', 'CRR-1001', 'courier', 'active', 41.178, -8.596, '2026-10-02 09:30:00'),
  (3, 'msousa', '$2y$10$pSqfpFen8fY8lCPFFZc1OOwbY37P8H7oh3VrI/1LiYjk5wMDeWLjy', 'staff@demo.com', 'Marta Sousa', '913456789', '218765436', 'STF-2001', 'staff', 'active', NULL, NULL, '2026-10-01 09:00:00'),
  (4, 'palmeida', '$2y$10$069Y8sVEWRNwKq9qaY2itOVS8ogDF/YsZu5Ti2edG.MLfSjkolUsi', 'admin@demo.com', 'Pedro Almeida', NULL, NULL, NULL, 'admin', 'active', NULL, NULL, '2026-09-30 18:00:00'),
  (5, 'sribeiro', '$2y$10$VUxCzEXAVCRoQFtXCcIz9eOLiPHBUtdyV6zhz3J/8QRVCmPUaOglW', 'sofia.ribeiro@demo.com', 'Sofia Ribeiro', '925104387', '241320987', 'CRR-1002', 'courier', 'active', 41.1467, -8.611, '2026-10-03 11:15:00'),
  (6, 'cnunes', '$2y$10$VUxCzEXAVCRoQFtXCcIz9eOLiPHBUtdyV6zhz3J/8QRVCmPUaOglW', 'carlos.nunes@demo.com', 'Carlos Nunes', '936218450', '267453190', 'CRR-1003', 'courier', 'active', 41.1239, -8.6118, '2026-10-04 14:20:00'),
  (7, 'icarvalho', '$2y$10$VUxCzEXAVCRoQFtXCcIz9eOLiPHBUtdyV6zhz3J/8QRVCmPUaOglW', 'ines.carvalho@demo.com', 'Inês Carvalho', '914667203', '238914560', 'CRR-1004', 'courier', 'active', NULL, NULL, '2026-10-05 16:40:00'),
  (8, 'blopes', '$2y$10$VUxCzEXAVCRoQFtXCcIz9eOLiPHBUtdyV6zhz3J/8QRVCmPUaOglW', 'client2@demo.com', 'Bruno Lopes', '961230845', '209876543', NULL, 'client', 'active', NULL, NULL, '2026-10-08 12:00:00'),
  (9, 'hbarbosa', '$2y$10$VUxCzEXAVCRoQFtXCcIz9eOLiPHBUtdyV6zhz3J/8QRVCmPUaOglW', 'hugo.barbosa@demo.com', 'Hugo Barbosa', '912004518', '251876349', 'CRR-2041', 'courier', 'pending', NULL, NULL, '2026-11-16 10:05:00'),
  (10, 'lfaria', '$2y$10$VUxCzEXAVCRoQFtXCcIz9eOLiPHBUtdyV6zhz3J/8QRVCmPUaOglW', 'leonor.faria@demo.com', 'Leonor Faria', '934771260', '230451985', 'CRR-2042', 'courier', 'pending', NULL, NULL, '2026-11-15 15:30:00'),
  (11, 'apinto', '$2y$10$VUxCzEXAVCRoQFtXCcIz9eOLiPHBUtdyV6zhz3J/8QRVCmPUaOglW', 'andre.pinto@demo.com', 'André Pinto', '965320417', '277133050', 'CRR-2043', 'courier', 'pending', NULL, NULL, '2026-11-14 18:45:00');

-- vehicle_types
INSERT INTO vehicle_types (id, type_name, max_weight_kg, max_vol_m3) VALUES
  (1, 'Bike', 15, 0.08),
  (2, 'Moto', 30, 0.18),
  (3, 'Van', 1000, 8),
  (4, 'Truck', 3500, 18);

-- vehicles (a inspecao do veiculo 6 expira em 5 dez 2026: gera alerta ao staff)
INSERT INTO vehicles (id, courier_id, vehicle_type_id, license_plate, model, insurance_expiry_date, inspection_expiry_date, insurance_expiry_doc, inspection_expiry_doc, approval_status, disapproval_reason, reviewed_by, reviewed_at, doc_updated_at, doc_checked, created_at) VALUES
  (1, 2, 3, '12-AB-34', 'Renault Kangoo', '2027-03-15', '2027-01-20', 'uploads/docs/insurance_1.pdf', 'uploads/docs/inspection_1.pdf', 'approved', NULL, 3, '2026-10-03 10:00:00', '2026-10-02 12:00:00', 1, '2026-10-02 12:00:00'),
  (2, 2, 2, '45-CD-67', 'Yamaha NMAX', '2027-05-10', '2027-02-11', 'uploads/docs/insurance_2.pdf', 'uploads/docs/inspection_2.pdf', 'approved', NULL, 3, '2026-10-03 10:05:00', '2026-10-02 12:00:00', 1, '2026-10-02 12:00:00'),
  (3, 2, 3, '78-EF-90', 'Mercedes Sprinter', '2027-04-01', '2027-04-01', 'uploads/docs/insurance_3.pdf', 'uploads/docs/inspection_3.pdf', 'pending', NULL, NULL, NULL, '2026-10-02 12:00:00', 0, '2026-10-02 12:00:00'),
  (4, 2, 3, '23-GH-45', 'Fiat Doblò', '2026-11-01', '2027-02-02', 'uploads/docs/insurance_4.pdf', 'uploads/docs/inspection_4.pdf', 'disapproved', 'Insurance expired on 1 Nov 2026.', 3, '2026-11-12 09:40:00', '2026-10-02 12:00:00', 1, '2026-10-02 12:00:00'),
  (5, 5, 3, '67-ST-21', 'Citroën Berlingo', '2027-06-30', '2027-03-14', 'uploads/docs/insurance_5.pdf', 'uploads/docs/inspection_5.pdf', 'approved', NULL, 3, '2026-10-06 11:20:00', '2026-10-02 12:00:00', 1, '2026-10-02 12:00:00'),
  (6, 5, 2, '31-KL-08', 'Honda PCX 125', '2027-02-18', '2026-12-05', 'uploads/docs/insurance_6.pdf', 'uploads/docs/inspection_6.pdf', 'pending', NULL, NULL, NULL, '2026-10-02 12:00:00', 0, '2026-10-02 12:00:00'),
  (7, 6, 3, '56-MN-12', 'Peugeot Partner', '2027-01-09', '2027-01-09', 'uploads/docs/insurance_7.pdf', 'uploads/docs/inspection_7.pdf', 'pending', NULL, NULL, NULL, '2026-10-02 12:00:00', 0, '2026-10-02 12:00:00'),
  (8, 6, 2, '09-UV-54', 'Honda Forza 350', '2027-07-22', '2027-05-05', 'uploads/docs/insurance_8.pdf', 'uploads/docs/inspection_8.pdf', 'approved', NULL, 3, '2026-10-07 15:10:00', '2026-10-02 12:00:00', 1, '2026-10-02 12:00:00'),
  (9, 7, 4, '90-QR-33', 'Iveco Daily', '2027-08-12', '2027-06-01', 'uploads/docs/insurance_9.pdf', 'uploads/docs/inspection_9.pdf', 'pending', NULL, NULL, NULL, '2026-10-02 12:00:00', 0, '2026-10-02 12:00:00');

-- products
INSERT INTO products (id, client_id, description, category, weight_kg, volume_m3, created_at) VALUES
  (1, 1, 'Box of books', 'Other', 12.5, 0.04, '2026-10-12 10:00:00'),
  (2, 1, 'Monitor 27"', 'Electronics', 6.8, 0.09, '2026-10-14 10:00:00'),
  (3, 1, 'Set of glasses', 'Other', 2.4, 0.02, '2026-10-20 10:00:00'),
  (4, 1, 'Office chair', 'Furniture', 14.0, 0.35, '2026-11-02 10:00:00'),
  (5, 8, 'Laptop', 'Electronics', 2.2, 0.01, '2026-10-15 09:00:00'),
  (6, 8, 'Winter coat', 'Clothing', 1.1, 0.01, '2026-10-18 09:00:00');

-- routes
INSERT INTO routes (id, courier_id, vehicle_id, status, total_weight_kg, total_vol_m3, created_at, started_at, completed_at) VALUES
  (1, 2, 1, 'completed', 19.3, 0.13, '2026-11-03 09:30:00', '2026-11-04 09:00:00', '2026-11-04 11:30:00'),
  (2, 5, 5, 'completed', 2.4, 0.02, '2026-11-09 15:20:00', '2026-11-10 09:30:00', '2026-11-10 10:15:00'),
  (3, 2, 1, 'in_progress', 15.1, 0.36, '2026-11-16 12:00:00', '2026-11-17 08:30:00', NULL),
  (4, 6, 8, 'planned', 1.1, 0.01, '2026-11-17 09:05:00', NULL, NULL),
  (5, 5, 5, 'in_progress', 2.2, 0.01, '2026-11-16 08:00:00', '2026-11-17 08:00:00', NULL),
  (6, 2, 2, 'completed', 4.8, 0.04, '2026-10-19 16:30:00', '2026-10-20 11:00:00', '2026-10-20 12:00:00'),
  (7, 5, 5, 'completed', 1.1, 0.01, '2026-10-27 10:30:00', '2026-10-28 09:20:00', '2026-10-28 09:50:00');

-- orders (preco = 2.50 + km*0.40 + MAX(kg, m3*200)*0.30)
INSERT INTO orders (id, client_id, courier_id, route_id, route_sequence, origin_lat, origin_long, dest_lat, dest_long, distance_km, declared_weight_kg, declared_vol_m3, actual_weight_kg, price_total, status, attempt, created_at, delivered_at) VALUES
  (1, 1, 2, 1, 1, 41.1495, -8.6065, 41.178, -8.596, 6.2, 19.3, 0.13, NULL, 12.78, 'Completed', 1, '2026-11-03 09:10:00', '2026-11-04 11:30:00'),
  (2, 1, 5, 2, 1, 41.1239, -8.6118, 41.1467, -8.611, 4.1, 2.4, 0.02, NULL, 5.34, 'Completed', 1, '2026-11-09 15:00:00', '2026-11-10 10:15:00'),
  (3, 1, 2, 3, 1, 41.158, -8.629, 41.2357, -8.6199, 9.8, 14.0, 0.35, NULL, 27.42, 'In Progress', 1, '2026-11-16 10:30:00', NULL),
  (4, 8, 6, 4, 1, 41.1467, -8.611, 41.152, -8.676, 6.9, 1.1, 0.01, NULL, 5.86, 'Initiated', 1, '2026-11-17 08:45:00', NULL),
  (5, 8, 2, 3, 2, 41.1495, -8.6065, 41.1821, -8.6891, 8.7, 1.1, 0.01, NULL, 6.58, 'In Progress', 1, '2026-11-16 11:10:00', NULL),
  (6, 1, NULL, NULL, NULL, 41.158, -8.629, 41.1239, -8.6118, 7.3, 12.5, 0.04, NULL, 9.17, 'Pending', 1, '2026-11-17 09:00:00', NULL),
  (7, 8, NULL, NULL, NULL, 41.178, -8.596, 41.1467, -8.611, 3.9, 2.2, 0.01, NULL, 4.72, 'Pending', 1, '2026-11-17 09:20:00', NULL),
  (8, 1, NULL, NULL, NULL, 41.1239, -8.6118, 41.1495, -8.6065, 2.8, 2.4, 0.02, NULL, 4.82, 'Cancelled', 1, '2026-11-12 18:00:00', NULL),
  (9, 8, 5, 5, 1, 41.1544, -8.5321, 41.1467, -8.611, 8.0, 2.2, 0.01, 6.0, 6.36, 'RTO', 1, '2026-11-15 14:00:00', NULL),
  (10, 1, 2, 6, 1, 41.1467, -8.611, 41.158, -8.629, 3.4, 4.8, 0.04, NULL, 6.26, 'Completed', 1, '2026-10-19 16:00:00', '2026-10-20 12:00:00'),
  (11, 8, 5, 7, 1, 41.178, -8.596, 41.1239, -8.6118, 10.9, 1.1, 0.01, NULL, 7.46, 'Completed', 1, '2026-10-27 10:00:00', '2026-10-28 09:50:00');

-- order_products
INSERT INTO order_products (order_id, product_id, quantity) VALUES
  (1, 1, 1),
  (1, 2, 1),
  (2, 3, 1),
  (3, 4, 1),
  (4, 6, 1),
  (5, 6, 1),
  (6, 1, 1),
  (7, 5, 1),
  (8, 3, 1),
  (9, 5, 1),
  (10, 3, 2),
  (11, 6, 1);

-- payments (WP1; a linha rto_fee da encomenda 9 pertence ao WP4)
INSERT INTO payments (order_id, kind, amount, gateway_ref, status, created_at, paid_at) VALUES
  (1, 'order', 12.78, 'MG-1001', 'paid', '2026-11-03 09:10:00', '2026-11-03 09:11:00'),
  (2, 'order', 5.34, 'MG-1002', 'paid', '2026-11-09 15:00:00', '2026-11-09 15:01:00'),
  (3, 'order', 27.42, 'MG-1003', 'paid', '2026-11-16 10:30:00', '2026-11-16 10:31:00'),
  (4, 'order', 5.86, 'MG-1004', 'paid', '2026-11-17 08:45:00', '2026-11-17 08:46:00'),
  (5, 'order', 6.58, 'MG-1005', 'paid', '2026-11-16 11:10:00', '2026-11-16 11:11:00'),
  (6, 'order', 9.17, 'MG-1006', 'paid', '2026-11-17 09:00:00', '2026-11-17 09:01:00'),
  (7, 'order', 4.72, NULL, 'pending', '2026-11-17 09:20:00', NULL),
  (8, 'order', 4.82, 'MG-1008', 'refunded', '2026-11-12 18:00:00', '2026-11-12 18:05:00'),
  (9, 'order', 6.36, 'MG-1009', 'paid', '2026-11-15 14:00:00', '2026-11-15 14:01:00'),
  (10, 'order', 6.26, 'MG-1010', 'paid', '2026-10-19 16:00:00', '2026-10-19 16:01:00'),
  (11, 'order', 7.46, 'MG-1011', 'paid', '2026-10-27 10:00:00', '2026-10-27 10:01:00'),
  (9, 'rto_fee', 4.34, NULL, 'pending', '2026-11-17 08:20:00', NULL);

-- reweigh_events (WP4): peso real 6.0 kg > 2.2 kg declarados
INSERT INTO reweigh_events (order_id, declared_weight_kg, actual_weight_kg, extra_fee, return_fee, status, created_at, resolved_at) VALUES
  (9, 2.2, 6.0, 1.14, 3.2, 'awaiting_payment', '2026-11-17 08:20:00', NULL);

-- dispatch_offers (WP3)
INSERT INTO dispatch_offers (order_id, courier_id, distance_km, offered_at, expires_at, status) VALUES
  (1, 2, 2.0, '2026-11-03 09:12:00', '2026-11-03 09:13:00', 'accepted'),
  (2, 5, 1.5, '2026-11-09 15:02:00', '2026-11-09 15:03:00', 'accepted'),
  (3, 2, 3.1, '2026-11-16 10:32:00', '2026-11-16 10:33:00', 'accepted'),
  (4, 6, 1.1, '2026-11-17 08:47:00', '2026-11-17 08:48:00', 'accepted'),
  (5, 2, 1.9, '2026-11-16 11:12:00', '2026-11-16 11:13:00', 'accepted'),
  (6, 6, 2.1, '2026-11-17 09:01:00', '2026-11-17 09:02:00', 'declined'),
  (6, 2, 3.4, '2026-11-17 09:02:10', '2026-11-17 09:03:10', 'expired'),
  (6, 5, 4.0, '2026-11-17 09:03:20', '2026-11-17 09:04:20', 'offered'),
  (9, 5, 2.6, '2026-11-15 14:02:00', '2026-11-15 14:03:00', 'accepted'),
  (10, 2, 1.2, '2026-10-19 16:02:00', '2026-10-19 16:03:00', 'accepted'),
  (11, 5, 2.2, '2026-10-27 10:02:00', '2026-10-27 10:03:00', 'accepted');

-- delivery_codes (WP5)
INSERT INTO delivery_codes (order_id, code, generated_at, used_at) VALUES
  (1, '482915', '2026-11-03 09:12:30', '2026-11-04 11:29:00'),
  (2, '730264', '2026-11-09 15:02:30', '2026-11-10 10:14:00'),
  (3, '159038', '2026-11-16 10:32:30', NULL),
  (4, '864721', '2026-11-17 08:47:30', NULL),
  (5, '307594', '2026-11-16 11:12:30', NULL),
  (9, '925618', '2026-11-15 14:02:30', NULL),
  (10, '618340', '2026-10-19 16:02:30', '2026-10-20 11:59:00'),
  (11, '245807', '2026-10-27 10:02:30', '2026-10-28 09:49:00');

-- proofs_of_delivery
INSERT INTO proofs_of_delivery (order_id, type, file, delivered_at) VALUES
  (1, 'photo', 'uploads/pod/order_1.jpg', '2026-11-04 11:30:00'),
  (2, 'signature', 'uploads/pod/order_2.png', '2026-11-10 10:15:00'),
  (10, 'photo', 'uploads/pod/order_10.jpg', '2026-10-20 12:00:00'),
  (11, 'signature', 'uploads/pod/order_11.png', '2026-10-28 09:50:00');

-- pricing_rates (valores do enunciado)
INSERT INTO pricing_rates (id, base_fee, rate_km, rate_kg, volumetric_factor, updated_by, updated_at) VALUES
  (1, 2.5, 0.4, 0.3, 200, 4, '2026-10-01 09:00:00');

