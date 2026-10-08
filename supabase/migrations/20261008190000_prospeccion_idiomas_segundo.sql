-- Mails a proveedores: Idiomas pasa a ser el rubro 2 de la rotación.
-- Aplicada en producción el 8/10/2026.
--
-- Pedido del fundador: la página /precios/clases-de-ingles/ reemplazó a la del
-- DJ y no hay profes de idiomas cargados, así que Idiomas se adelanta para que
-- la página tenga quien responda. Plomería sigue siendo el 1 (arranca el 9/10);
-- los rubros que estaban del 2 al 36 corren un lugar. Al terminar la vuelta,
-- la rotación vuelve a empezar por el 1, como antes.

update growth_mkt_rotacion set orden = orden + 100
 where workspace_id = (select id from growth_workspaces where slug = 'tratto') and orden between 2 and 36;
update growth_mkt_rotacion set orden = 2
 where workspace_id = (select id from growth_workspaces where slug = 'tratto') and rubro = 'Idiomas';
update growth_mkt_rotacion set orden = orden - 99
 where workspace_id = (select id from growth_workspaces where slug = 'tratto') and orden > 100;
