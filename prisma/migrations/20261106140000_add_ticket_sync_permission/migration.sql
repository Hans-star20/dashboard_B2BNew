INSERT IGNORE INTO `permissions` (`id`, `code`, `description`, `isSystem`)
VALUES (UUID(), 'tickets.sync', 'Menjalankan dan melihat sinkronisasi tiket', true)
;

INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`)
SELECT `roles`.`id`, `permissions`.`id`
FROM `roles`
JOIN `permissions` ON `permissions`.`code` = 'tickets.sync'
WHERE BINARY `roles`.`name` = BINARY 'SUPERUSER'
;
