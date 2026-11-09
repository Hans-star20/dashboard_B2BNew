-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `roleId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `name` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `primarySuperuserKey` VARCHAR(16) NULL,
    `createdByUserId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_user_email`(`email`),
    UNIQUE INDEX `uq_user_primary_superuser`(`primarySuperuserKey`),
    INDEX `idx_user_role_active`(`roleId`, `isActive`),
    INDEX `idx_user_created_by`(`createdByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `description` VARCHAR(255) NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `uq_role_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `code` VARCHAR(128) NOT NULL,
    `description` VARCHAR(255) NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `uq_permission_code`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_permissions` (
    `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `userId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `permissionId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `grantedByUserId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,
    `activeGrantKey` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs GENERATED ALWAYS AS (CASE WHEN `revokedAt` IS NULL THEN `permissionId` ELSE NULL END) STORED,
    `revokedByUserId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL,

    INDEX `idx_user_permission_history_lookup`(`userId`, `permissionId`, `revokedAt`),
    INDEX `idx_user_permission_permission`(`permissionId`),
    INDEX `idx_user_permission_grantor`(`grantedByUserId`),
    INDEX `idx_user_permission_revoker`(`revokedByUserId`),
    UNIQUE INDEX `uq_user_permission_active_grant`(`userId`, `activeGrantKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `roleId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `permissionId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,

    INDEX `idx_role_permission_permission`(`permissionId`),
    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `technician_identity_history` (
    `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `technicianId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `nik` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `activeNikKey` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL,
    `identityKind` ENUM('SOURCE', 'APPLICATION', 'BOTH') NOT NULL,
    `validFrom` DATETIME(3) NOT NULL,
    `validTo` DATETIME(3) NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `recordedByUserId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL,
    `recordedBySyncLogId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL,
    `closedAt` DATETIME(3) NULL,
    `closedByUserId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL,
    `changeReason` VARCHAR(255) NULL,

    UNIQUE INDEX `uq_active_technician_nik`(`activeNikKey`),
    INDEX `idx_technician_identity_history`(`technicianId`, `validFrom`),
    INDEX `idx_identity_history_recorder`(`recordedByUserId`),
    INDEX `idx_identity_history_sync_recorder`(`recordedBySyncLogId`),
    INDEX `idx_identity_history_closer`(`closedByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `technician_identity_conflicts` (
    `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `ticketIncident` VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `suspectedTechnicianId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL,
    `resolvedTechnicianId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL,
    `sourceNik` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `foundAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewedByUserId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL,
    `reviewedAt` DATETIME(3) NULL,
    `decisionReason` VARCHAR(1000) NULL,
    `detectedBySyncLogId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,

    INDEX `idx_identity_conflict_status_found`(`status`, `foundAt`),
    INDEX `idx_identity_conflict_pending_group`(`ticketIncident`, `sourceNik`, `status`),
    INDEX `idx_identity_conflict_suspected`(`suspectedTechnicianId`, `status`),
    INDEX `idx_identity_conflict_resolved`(`resolvedTechnicianId`, `reviewedAt`),
    INDEX `idx_identity_conflict_source_nik`(`sourceNik`, `foundAt`),
    INDEX `idx_identity_conflict_reviewer`(`reviewedByUserId`, `reviewedAt`),
    UNIQUE INDEX `uq_identity_conflict_detection`(`ticketIncident`, `detectedBySyncLogId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_technician_link_history` (
    `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `ticketIncident` VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `previousTechnicianId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL,
    `newTechnicianId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `actionByUserId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `actionType` ENUM('MANUAL_LINK', 'CONFLICT_RESOLUTION', 'CORRECTION') NOT NULL,
    `reason` VARCHAR(1000) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_ticket_technician_link_ticket_time`(`ticketIncident`, `createdAt`),
    INDEX `idx_ticket_technician_link_previous`(`previousTechnicianId`),
    INDEX `idx_ticket_technician_link_new_time`(`newTechnicianId`, `createdAt`),
    INDEX `idx_ticket_technician_link_actor_time`(`actionByUserId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `technicians` (
    `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `sourceNik` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL,
    `nik` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL,
    `name` VARCHAR(191) NULL,
    `sourceName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `nameNeedsReview` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_technician_source_nik`(`sourceNik`),
    UNIQUE INDEX `uq_technician_nik`(`nik`),
    INDEX `idx_technician_active_name`(`isActive`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_types` (
    `id` SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sourceValue` VARCHAR(100) NOT NULL,
    `sourceValueMatchKey` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci NOT NULL,
    `dashboardCategory` ENUM('DATIN', 'HSI', 'WIFI', 'SQUAT', 'UNCLASSIFIED') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_service_type_match_key`(`sourceValueMatchKey`),
    INDEX `idx_service_type_active_category`(`isActive`, `dashboardCategory`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tickets` (
    `incident` VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `incidentMatchKey` VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci NOT NULL,
    `incidentSourceRaw` VARCHAR(128) NOT NULL,
    `sourceStatus` VARCHAR(191) NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL,
    `statusNeedsReview` BOOLEAN NOT NULL DEFAULT false,
    `sourceServiceType` VARCHAR(100) NULL,
    `serviceTypeId` SMALLINT UNSIGNED NOT NULL,
    `serviceTypeNeedsReview` BOOLEAN NOT NULL DEFAULT false,
    `technicianId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL,
    `technicianSourceNikRaw` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL,
    `technicianNeedsReview` BOOLEAN NOT NULL DEFAULT false,
    `technicianSourceConflict` BOOLEAN NOT NULL DEFAULT false,
    `reportedAt` DATETIME(3) NOT NULL,
    `resolvedAt` DATETIME(3) NULL,
    `lastSeenAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_ticket_incident_match_key`(`incidentMatchKey`),
    INDEX `idx_ticket_status_reported_at`(`status`, `reportedAt`),
    INDEX `idx_ticket_service_status`(`serviceTypeId`, `status`),
    INDEX `idx_ticket_technician_reported_at`(`technicianId`, `reportedAt`),
    INDEX `idx_ticket_technician_review`(`technicianNeedsReview`, `reportedAt`),
    INDEX `idx_ticket_technician_conflict`(`technicianSourceConflict`, `reportedAt`),
    INDEX `idx_ticket_resolved_at`(`resolvedAt`),
    INDEX `idx_ticket_last_seen_at`(`lastSeenAt`),
    PRIMARY KEY (`incident`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_logs` (
    `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `runKey` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `status` ENUM('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED') NOT NULL DEFAULT 'RUNNING',
    `attemptCount` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `lastAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `inserted` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `updated` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `unchanged` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `skipped` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `failed` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `rowsRead` INTEGER UNSIGNED NULL,
    `failureDetails` JSON NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `initiatedByUserId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NULL,
    `errorCode` VARCHAR(64) NULL,
    `errorSummary` VARCHAR(1000) NULL,

    UNIQUE INDEX `uq_sync_log_run_key`(`runKey`),
    INDEX `idx_sync_log_status_started_at`(`status`, `startedAt`),
    INDEX `idx_sync_log_started_at`(`startedAt`),
    INDEX `idx_sync_log_initiated_by`(`initiatedByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Prisma does not represent per-column collations, CHECK constraints, or triggers.
ALTER TABLE `users`
    ADD CONSTRAINT `chk_user_primary_superuser_key`
        CHECK (`primarySuperuserKey` IS NULL OR BINARY `primarySuperuserKey` = BINARY 'PRIMARY');

ALTER TABLE `roles`
    ADD CONSTRAINT `chk_role_superuser_canonical`
        CHECK (`name` <> 'SUPERUSER' OR BINARY `name` = BINARY 'SUPERUSER');

ALTER TABLE `technicians`
    ADD CONSTRAINT `chk_technician_source_nik_format`
        CHECK (`sourceNik` IS NULL OR REGEXP_LIKE(`sourceNik`, '^[0-9]{4,8}$', 'c')),
    ADD CONSTRAINT `chk_technician_nik_format`
        CHECK (`nik` IS NULL OR REGEXP_LIKE(`nik`, '^[0-9]{4,8}$', 'c'));

ALTER TABLE `technician_identity_history`
    ADD CONSTRAINT `chk_identity_history_nik_format`
        CHECK (REGEXP_LIKE(`nik`, '^[0-9]{4,8}$', 'c')),
    ADD CONSTRAINT `chk_identity_history_active_nik_format`
        CHECK (`activeNikKey` IS NULL OR REGEXP_LIKE(`activeNikKey`, '^[0-9]{4,8}$', 'c')),
    ADD CONSTRAINT `chk_identity_history_recorder_xor`
        CHECK ((`recordedByUserId` IS NULL) <> (`recordedBySyncLogId` IS NULL)),
    ADD CONSTRAINT `chk_identity_history_state`
        CHECK (
            (`validTo` IS NULL AND `closedAt` IS NULL AND `closedByUserId` IS NULL
                AND `activeNikKey` IS NOT NULL AND `activeNikKey` = `nik`)
            OR
            (`validTo` IS NOT NULL AND `closedAt` IS NOT NULL AND `closedByUserId` IS NOT NULL
                AND `activeNikKey` IS NULL AND `closedAt` = `validTo` AND `validTo` >= `validFrom`)
        );

ALTER TABLE `technician_identity_conflicts`
    ADD CONSTRAINT `chk_identity_conflict_nik_format`
        CHECK (REGEXP_LIKE(`sourceNik`, '^[0-9]{4,8}$', 'c')),
    ADD CONSTRAINT `chk_identity_conflict_review_state`
        CHECK (
            (`status` = 'PENDING' AND `reviewedByUserId` IS NULL AND `reviewedAt` IS NULL AND `decisionReason` IS NULL)
            OR
            (`status` = 'APPROVED' AND `reviewedByUserId` IS NOT NULL AND `reviewedAt` IS NOT NULL
                AND `decisionReason` IS NOT NULL AND CHAR_LENGTH(TRIM(`decisionReason`)) > 0
                AND `resolvedTechnicianId` IS NOT NULL)
            OR
            (`status` = 'REJECTED' AND `reviewedByUserId` IS NOT NULL AND `reviewedAt` IS NOT NULL
                AND `decisionReason` IS NOT NULL AND CHAR_LENGTH(TRIM(`decisionReason`)) > 0
                AND `resolvedTechnicianId` IS NULL)
        );

ALTER TABLE `ticket_technician_link_history`
    ADD CONSTRAINT `chk_ticket_technician_link_reason`
        CHECK (CHAR_LENGTH(TRIM(`reason`)) > 0);

ALTER TABLE `tickets`
    ADD CONSTRAINT `chk_ticket_technician_source_nik_format`
        CHECK (`technicianSourceNikRaw` IS NULL OR REGEXP_LIKE(`technicianSourceNikRaw`, '^[0-9]{4,8}$', 'c'));

ALTER TABLE `user_permissions`
    ADD CONSTRAINT `chk_user_permission_revocation_pair`
        CHECK ((`revokedAt` IS NULL) = (`revokedByUserId` IS NULL));

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_permissions` ADD CONSTRAINT `user_permissions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_permissions` ADD CONSTRAINT `user_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_permissions` ADD CONSTRAINT `user_permissions_grantedByUserId_fkey` FOREIGN KEY (`grantedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_permissions` ADD CONSTRAINT `user_permissions_revokedByUserId_fkey` FOREIGN KEY (`revokedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `technician_identity_history` ADD CONSTRAINT `technician_identity_history_technicianId_fkey` FOREIGN KEY (`technicianId`) REFERENCES `technicians`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `technician_identity_history` ADD CONSTRAINT `technician_identity_history_recordedByUserId_fkey` FOREIGN KEY (`recordedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `technician_identity_history` ADD CONSTRAINT `technician_identity_history_closedByUserId_fkey` FOREIGN KEY (`closedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `technician_identity_history` ADD CONSTRAINT `technician_identity_history_recordedBySyncLogId_fkey` FOREIGN KEY (`recordedBySyncLogId`) REFERENCES `sync_logs`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `technician_identity_conflicts` ADD CONSTRAINT `technician_identity_conflicts_ticketIncident_fkey` FOREIGN KEY (`ticketIncident`) REFERENCES `tickets`(`incident`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `technician_identity_conflicts` ADD CONSTRAINT `technician_identity_conflicts_suspectedTechnicianId_fkey` FOREIGN KEY (`suspectedTechnicianId`) REFERENCES `technicians`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `technician_identity_conflicts` ADD CONSTRAINT `technician_identity_conflicts_resolvedTechnicianId_fkey` FOREIGN KEY (`resolvedTechnicianId`) REFERENCES `technicians`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `technician_identity_conflicts` ADD CONSTRAINT `technician_identity_conflicts_reviewedByUserId_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `technician_identity_conflicts` ADD CONSTRAINT `technician_identity_conflicts_detectedBySyncLogId_fkey` FOREIGN KEY (`detectedBySyncLogId`) REFERENCES `sync_logs`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ticket_technician_link_history` ADD CONSTRAINT `ticket_technician_link_history_ticketIncident_fkey` FOREIGN KEY (`ticketIncident`) REFERENCES `tickets`(`incident`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ticket_technician_link_history` ADD CONSTRAINT `ticket_technician_link_history_previousTechnicianId_fkey` FOREIGN KEY (`previousTechnicianId`) REFERENCES `technicians`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ticket_technician_link_history` ADD CONSTRAINT `ticket_technician_link_history_newTechnicianId_fkey` FOREIGN KEY (`newTechnicianId`) REFERENCES `technicians`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ticket_technician_link_history` ADD CONSTRAINT `ticket_technician_link_history_actionByUserId_fkey` FOREIGN KEY (`actionByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_serviceTypeId_fkey` FOREIGN KEY (`serviceTypeId`) REFERENCES `service_types`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_technicianId_fkey` FOREIGN KEY (`technicianId`) REFERENCES `technicians`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `sync_logs` ADD CONSTRAINT `sync_logs_initiatedByUserId_fkey` FOREIGN KEY (`initiatedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TRIGGER `users_before_insert_primary_superuser`
BEFORE INSERT ON `users` FOR EACH ROW
BEGIN
    DECLARE targetRoleName VARCHAR(64) DEFAULT NULL;
    SELECT `name` INTO targetRoleName FROM `roles` WHERE `id` = NEW.`roleId`;
    IF ((NEW.`primarySuperuserKey` IS NOT NULL) <> (BINARY targetRoleName = BINARY 'SUPERUSER')) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Primary marker must match SUPERUSER role';
    END IF;
END;

CREATE TRIGGER `users_before_update_primary_superuser`
BEFORE UPDATE ON `users` FOR EACH ROW
BEGIN
    DECLARE targetRoleName VARCHAR(64) DEFAULT NULL;
    SELECT `name` INTO targetRoleName FROM `roles` WHERE `id` = NEW.`roleId`;
    IF ((NEW.`primarySuperuserKey` IS NOT NULL) <> (BINARY targetRoleName = BINARY 'SUPERUSER')) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Primary marker must match SUPERUSER role';
    END IF;
END;

CREATE TRIGGER `roles_before_update_protect_superuser`
BEFORE UPDATE ON `roles` FOR EACH ROW
BEGIN
    IF ((BINARY OLD.`name` = BINARY 'SUPERUSER') <> (BINARY NEW.`name` = BINARY 'SUPERUSER')) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SUPERUSER role name is reserved';
    END IF;
END;

CREATE TRIGGER `roles_before_delete_protect_superuser`
BEFORE DELETE ON `roles` FOR EACH ROW
BEGIN
    IF (BINARY OLD.`name` = BINARY 'SUPERUSER') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SUPERUSER role cannot be deleted';
    END IF;
END;

CREATE TRIGGER `service_types_before_insert_unclassified`
BEFORE INSERT ON `service_types` FOR EACH ROW
BEGIN
    IF (NEW.`sourceValueMatchKey` = 'UNCLASSIFIED'
        AND NOT (BINARY NEW.`sourceValue` = BINARY 'UNCLASSIFIED'
            AND BINARY NEW.`sourceValueMatchKey` = BINARY 'UNCLASSIFIED'
            AND NEW.`dashboardCategory` = 'UNCLASSIFIED' AND NEW.`isActive` = TRUE)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'UNCLASSIFIED fallback must use canonical values and remain active';
    END IF;
END;

CREATE TRIGGER `service_types_before_update_unclassified`
BEFORE UPDATE ON `service_types` FOR EACH ROW
BEGIN
    IF ((OLD.`sourceValueMatchKey` = 'UNCLASSIFIED' OR NEW.`sourceValueMatchKey` = 'UNCLASSIFIED')
        AND NOT (BINARY NEW.`sourceValue` = BINARY 'UNCLASSIFIED'
            AND BINARY NEW.`sourceValueMatchKey` = BINARY 'UNCLASSIFIED'
            AND NEW.`dashboardCategory` = 'UNCLASSIFIED' AND NEW.`isActive` = TRUE)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'UNCLASSIFIED fallback must use canonical values and remain active';
    END IF;
END;

CREATE TRIGGER `service_types_before_delete_unclassified`
BEFORE DELETE ON `service_types` FOR EACH ROW
BEGIN
    IF (OLD.`sourceValueMatchKey` = 'UNCLASSIFIED') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'UNCLASSIFIED fallback cannot be deleted';
    END IF;
END;

INSERT INTO `service_types`
    (`sourceValue`, `sourceValueMatchKey`, `dashboardCategory`, `isActive`, `createdAt`, `updatedAt`)
VALUES
    ('UNCLASSIFIED', 'UNCLASSIFIED', 'UNCLASSIFIED', TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;
