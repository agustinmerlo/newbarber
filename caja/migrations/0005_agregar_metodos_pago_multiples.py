from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('caja', '0004_agregar_sistema_turnos'),
    ]

    operations = [
        # Agregar campos de montos esperados por método
        migrations.AddField(
            model_name='turnocaja',
            name='transferencia_esperada',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='turnocaja',
            name='mercadopago_esperado',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='turnocaja',
            name='seña_esperada',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        
        # Agregar campos de montos de cierre
        migrations.AddField(
            model_name='turnocaja',
            name='monto_cierre_transferencia',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='turnocaja',
            name='monto_cierre_mercadopago',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='turnocaja',
            name='monto_cierre_seña',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        
        # Agregar campos de diferencias
        migrations.AddField(
            model_name='turnocaja',
            name='diferencia_transferencia',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='turnocaja',
            name='diferencia_mercadopago',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='turnocaja',
            name='diferencia_seña',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='turnocaja',
            name='diferencia_total',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        
        # Agregar 'seña' como opción en metodo_pago de MovimientoCaja
        migrations.AlterField(
            model_name='movimientocaja',
            name='metodo_pago',
            field=models.CharField(
                choices=[
                    ('efectivo', 'Efectivo'),
                    ('tarjeta', 'Tarjeta'),
                    ('transferencia', 'Transferencia'),
                    ('mercadopago', 'Mercado Pago'),
                    ('seña', 'Seña'),
                ],
                default='efectivo',
                max_length=20
            ),
        ),
    ]