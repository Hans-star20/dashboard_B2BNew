CREATE TABLE `user_sessions` (
    `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `userId` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,

    UNIQUE INDEX `uq_user_session_token_hash`(`tokenHash`),
    INDEX `idx_user_session_user_revoked`(`userId`, `revokedAt`),
    INDEX `idx_user_session_expires_at`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `login_throttles` (
    `id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
    `attemptKey` CHAR(64) NOT NULL,
    `attempts` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `windowStartedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lockedUntil` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_login_throttle_attempt_key`(`attemptKey`),
    INDEX `idx_login_throttle_locked_until`(`lockedUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `user_sessions`
    ADD CONSTRAINT `user_sessions_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT;
