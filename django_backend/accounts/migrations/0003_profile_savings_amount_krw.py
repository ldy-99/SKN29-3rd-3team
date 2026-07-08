# Generated manually to add Profile.savings_amount_krw (저축액, 특별공급 판정용)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_profile_dependent_family_count_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='savings_amount_krw',
            field=models.BigIntegerField(blank=True, null=True),
        ),
    ]
