from setuptools import find_packages, setup

package_name = 'gressus_pgear'

setup(
    name=package_name,
    version='0.0.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Ulan Sharipov',
    maintainer_email='ulan.sharipov@nu.edu.kz',
    description='P.GEAR UDP telemetry ROS node (LogPacket broadcast receiver)',
    license='Apache-2.0',
    extras_require={
        'test': [
            'pytest',
        ],
    },
    entry_points={
        'console_scripts': [
            'pgear_device_node = gressus_pgear.pgear_device_node:main',
        ],
    },
)
