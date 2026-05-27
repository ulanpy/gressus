from setuptools import find_packages, setup

package_name = 'gressus_calibration'

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
    maintainer='root',
    maintainer_email='ulan.sharipov@nu.edu.kz',
    description='AprilTag camera–projector calibration for Gressus',
    license='Apache-2.0',
    extras_require={
        'test': [
            'pytest',
        ],
    },
    entry_points={
        'console_scripts': [
            'calibrate_apriltag = gressus_calibration.calibrate_apriltag:main',
        ],
    },
)
